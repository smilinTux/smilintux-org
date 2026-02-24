#!/usr/bin/env python3
"""
Pre-release verification — checks all packages build cleanly.

Runs locally before pushing a release tag to catch issues early.
Tool-agnostic: run from any terminal.

Usage:
    python scripts/check-release.py           # check all
    python scripts/check-release.py skcapstone # check one
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

PACKAGES = {
    "skcapstone": REPO_ROOT / "skcapstone",
    "capauth": REPO_ROOT / "capauth",
    "skmemory": REPO_ROOT / "skmemory",
    "skcomm": REPO_ROOT / "skcomm",
}


def check_package(name: str, pkg_dir: Path) -> list[str]:
    """Run build and verification checks on a single package.

    Args:
        name: Package name.
        pkg_dir: Path to the package directory.

    Returns:
        List of error messages (empty = all good).
    """
    errors: list[str] = []

    pyproject = pkg_dir / "pyproject.toml"
    if not pyproject.exists():
        errors.append(f"{name}: pyproject.toml not found")
        return errors

    print(f"\n{'=' * 60}")
    print(f"  Checking {name}")
    print(f"{'=' * 60}")

    dist_dir = pkg_dir / "dist"
    if dist_dir.exists():
        import shutil
        shutil.rmtree(dist_dir)

    print(f"  Building sdist + wheel...")
    result = subprocess.run(
        [sys.executable, "-m", "build"],
        cwd=pkg_dir,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        errors.append(f"{name}: build failed\n{result.stderr[-500:]}")
        return errors

    artifacts = list(dist_dir.glob("*")) if dist_dir.exists() else []
    sdists = [a for a in artifacts if a.suffix == ".gz"]
    wheels = [a for a in artifacts if a.suffix == ".whl"]

    if not sdists:
        errors.append(f"{name}: no sdist produced")
    if not wheels:
        errors.append(f"{name}: no wheel produced")

    for a in artifacts:
        size_kb = a.stat().st_size / 1024
        print(f"  Built: {a.name} ({size_kb:.1f} KB)")

    print(f"  Running twine check...")
    result = subprocess.run(
        [sys.executable, "-m", "twine", "check", "dist/*"],
        cwd=pkg_dir,
        capture_output=True,
        text=True,
        shell=False,
    )
    twine_check = subprocess.run(
        [sys.executable, "-m", "twine", "check"] + [str(a) for a in artifacts],
        capture_output=True,
        text=True,
    )
    if twine_check.returncode != 0:
        errors.append(f"{name}: twine check failed\n{twine_check.stdout}")
    else:
        print(f"  twine check: PASSED")

    print(f"  Running tests...")
    test_result = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/", "-q", "--tb=line"],
        cwd=pkg_dir,
        capture_output=True,
        text=True,
    )
    if test_result.returncode != 0:
        errors.append(f"{name}: tests failed\n{test_result.stdout[-500:]}")
    else:
        last_line = test_result.stdout.strip().split("\n")[-1]
        print(f"  tests: {last_line}")

    if not errors:
        print(f"  {name}: ALL CHECKS PASSED")

    return errors


def main() -> None:
    """Run checks on requested packages."""
    requested = sys.argv[1:] if len(sys.argv) > 1 else list(PACKAGES.keys())

    all_errors: list[str] = []

    for name in requested:
        pkg_dir = PACKAGES.get(name)
        if pkg_dir is None:
            print(f"Unknown package: {name}")
            print(f"Available: {', '.join(PACKAGES.keys())}")
            sys.exit(1)

        errors = check_package(name, pkg_dir)
        all_errors.extend(errors)

    print(f"\n{'=' * 60}")
    if all_errors:
        print(f"  FAILED — {len(all_errors)} error(s):")
        for err in all_errors:
            print(f"    - {err.split(chr(10))[0]}")
        sys.exit(1)
    else:
        print(f"  ALL {len(requested)} PACKAGE(S) READY FOR RELEASE")
    print(f"{'=' * 60}\n")


if __name__ == "__main__":
    main()
