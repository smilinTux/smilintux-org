"""Seed the skills registry with the 3 example skill packages.

Usage:
    REGISTRY_URL=http://localhost:8080 REGISTRY_ADMIN_TOKEN=secret python seed_examples.py

This script packages the example skills from the skskills/examples/ directory
and publishes them to the registry API.
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import sys
import tarfile
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

REGISTRY_URL = os.environ.get("REGISTRY_URL", "http://localhost:8080")
ADMIN_TOKEN = os.environ.get("REGISTRY_ADMIN_TOKEN", "")
EXAMPLES_DIR = Path(__file__).parent.parent / "skskills" / "examples"

EXAMPLES = ["syncthing-setup", "skcapstone-agent", "pgp-identity"]


def package_skill(skill_dir: Path) -> tuple[str, bytes]:
    """Package a skill directory into a tarball. Returns (filename, bytes)."""
    import yaml

    skill_yaml = skill_dir / "skill.yaml"
    manifest = yaml.safe_load(skill_yaml.read_text())
    name = manifest["name"]
    version = manifest.get("version", "0.1.0")
    filename = f"{name}-{version}.tar.gz"

    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for item in sorted(skill_dir.rglob("*")):
            rel = item.relative_to(skill_dir)
            parts = rel.parts
            if any(p.startswith(".") or p in ("__pycache__", ".venv") for p in parts):
                continue
            tar.add(item, arcname=str(rel))

    buf.seek(0)
    return filename, buf.read()


def publish_skill(filename: str, data: bytes) -> dict:
    """POST a tarball to the registry API."""
    boundary = "----SkillsBoundary"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="tarball"; filename="{filename}"\r\n'
        f"Content-Type: application/gzip\r\n\r\n"
    ).encode() + data + f"\r\n--{boundary}--\r\n".encode()

    headers = {
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Accept": "application/json",
    }
    if ADMIN_TOKEN:
        headers["Authorization"] = f"Bearer {ADMIN_TOKEN}"

    req = urllib.request.Request(
        f"{REGISTRY_URL}/api/skills",
        data=body,
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        body = exc.read().decode()
        return {"error": f"HTTP {exc.code}: {body}"}


def main():
    print(f"Seeding registry at {REGISTRY_URL}")
    print(f"Examples dir: {EXAMPLES_DIR}\n")

    if not EXAMPLES_DIR.exists():
        print(f"ERROR: examples directory not found: {EXAMPLES_DIR}", file=sys.stderr)
        sys.exit(1)

    for skill_name in EXAMPLES:
        skill_dir = EXAMPLES_DIR / skill_name
        if not skill_dir.exists():
            print(f"  SKIP {skill_name}: directory not found")
            continue

        print(f"  Packaging {skill_name}...", end=" ")
        try:
            filename, data = package_skill(skill_dir)
            sha256 = hashlib.sha256(data).hexdigest()[:12]
            print(f"{len(data)} bytes, sha256={sha256}...")
        except Exception as exc:
            print(f"FAILED to package: {exc}")
            continue

        print(f"  Publishing {filename}...", end=" ")
        result = publish_skill(filename, data)
        if "error" in result:
            print(f"FAILED: {result['error']}")
        else:
            print(f"OK — sha256={result.get('sha256', '')[:12]}...")

    print("\nDone. Verify with:")
    print(f"  curl {REGISTRY_URL}/api/skills | python -m json.tool")


if __name__ == "__main__":
    main()
