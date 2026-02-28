"""SQLite-backed storage for the skills registry.

Schema:
  skills      — published skill metadata
  packages    — skill tarballs (stored on disk, metadata in DB)
  publishers  — CapAuth fingerprints allowed to publish
"""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


def _db_path() -> Path:
    return Path(os.environ.get("REGISTRY_DB", "/var/lib/skills-registry/registry.db"))


def _packages_dir() -> Path:
    return Path(os.environ.get("REGISTRY_PACKAGES_DIR", "/var/lib/skills-registry/packages"))


class SkillStorage:
    """SQLite-backed registry storage.

    Args:
        db_path: Path to the SQLite database file.
        packages_dir: Directory where skill tarballs are stored.
    """

    def __init__(
        self,
        db_path: Optional[Path] = None,
        packages_dir: Optional[Path] = None,
    ) -> None:
        self.db_path = db_path or _db_path()
        self.packages_dir = packages_dir or _packages_dir()

        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.packages_dir.mkdir(parents=True, exist_ok=True)

        self._init_schema()

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        return conn

    def _init_schema(self) -> None:
        with self._conn() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS skills (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    name        TEXT NOT NULL,
                    version     TEXT NOT NULL,
                    description TEXT DEFAULT '',
                    author      TEXT DEFAULT '',
                    author_fingerprint TEXT DEFAULT '',
                    tags        TEXT DEFAULT '[]',
                    signed      INTEGER DEFAULT 0,
                    signed_by   TEXT DEFAULT '',
                    sha256      TEXT DEFAULT '',
                    tarball_path TEXT DEFAULT '',
                    published_at TEXT NOT NULL,
                    publisher_fingerprint TEXT DEFAULT '',
                    UNIQUE(name, version)
                );

                CREATE TABLE IF NOT EXISTS publishers (
                    fingerprint TEXT PRIMARY KEY,
                    name        TEXT DEFAULT '',
                    email       TEXT DEFAULT '',
                    trusted_at  TEXT NOT NULL,
                    trusted_by  TEXT DEFAULT 'admin'
                );

                CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name);
                CREATE INDEX IF NOT EXISTS idx_skills_published ON skills(published_at DESC);
            """)

    # -----------------------------------------------------------------------
    # Skill CRUD
    # -----------------------------------------------------------------------

    def publish_skill(
        self,
        name: str,
        version: str,
        description: str,
        author: str,
        author_fingerprint: str,
        tags: list[str],
        signed: bool,
        signed_by: str,
        tarball_bytes: bytes,
        publisher_fingerprint: str = "",
    ) -> dict:
        """Store a new skill package.

        Returns:
            dict with name, version, sha256, download_url fragment.

        Raises:
            ValueError: If name/version already exists.
        """
        sha256 = hashlib.sha256(tarball_bytes).hexdigest()

        # Write tarball to disk
        tarball_name = f"{name}-{version}.tar.gz"
        tarball_path = self.packages_dir / name / tarball_name
        tarball_path.parent.mkdir(parents=True, exist_ok=True)
        tarball_path.write_bytes(tarball_bytes)

        try:
            with self._conn() as conn:
                conn.execute(
                    """
                    INSERT INTO skills
                        (name, version, description, author, author_fingerprint,
                         tags, signed, signed_by, sha256, tarball_path,
                         published_at, publisher_fingerprint)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        name, version, description, author, author_fingerprint,
                        json.dumps(tags), int(signed), signed_by, sha256,
                        str(tarball_path), datetime.now(tz=timezone.utc).isoformat(),
                        publisher_fingerprint,
                    ),
                )
        except sqlite3.IntegrityError:
            raise ValueError(f"Skill '{name}' v{version} already published")

        return {
            "name": name,
            "version": version,
            "sha256": sha256,
            "download_path": f"/api/skills/{name}/{version}/download",
        }

    def get_skill(self, name: str, version: Optional[str] = None) -> Optional[dict]:
        """Fetch a single skill entry (latest version if version=None)."""
        with self._conn() as conn:
            if version:
                row = conn.execute(
                    "SELECT * FROM skills WHERE name=? AND version=?", (name, version)
                ).fetchone()
            else:
                row = conn.execute(
                    "SELECT * FROM skills WHERE name=? ORDER BY published_at DESC LIMIT 1",
                    (name,),
                ).fetchone()
        return dict(row) if row else None

    def list_skills(self, query: Optional[str] = None, limit: int = 100) -> list[dict]:
        """List published skills, with optional keyword search."""
        with self._conn() as conn:
            if query:
                q = f"%{query.lower()}%"
                rows = conn.execute(
                    """
                    SELECT * FROM skills
                    WHERE lower(name) LIKE ?
                       OR lower(description) LIKE ?
                       OR lower(tags) LIKE ?
                    ORDER BY published_at DESC
                    LIMIT ?
                    """,
                    (q, q, q, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM skills ORDER BY published_at DESC LIMIT ?", (limit,)
                ).fetchall()
        return [dict(r) for r in rows]

    def list_versions(self, name: str) -> list[dict]:
        """List all versions of a skill."""
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM skills WHERE name=? ORDER BY published_at DESC",
                (name,),
            ).fetchall()
        return [dict(r) for r in rows]

    def get_tarball(self, name: str, version: str) -> Optional[bytes]:
        """Read tarball bytes for a skill version."""
        row = self.get_skill(name, version)
        if not row:
            return None
        p = Path(row["tarball_path"])
        return p.read_bytes() if p.exists() else None

    def delete_skill(self, name: str, version: str) -> bool:
        """Remove a skill version (admin only)."""
        row = self.get_skill(name, version)
        if not row:
            return False
        p = Path(row["tarball_path"])
        if p.exists():
            p.unlink()
        with self._conn() as conn:
            conn.execute("DELETE FROM skills WHERE name=? AND version=?", (name, version))
        return True

    # -----------------------------------------------------------------------
    # Publisher trust
    # -----------------------------------------------------------------------

    def is_trusted_publisher(self, fingerprint: str) -> bool:
        if not fingerprint:
            return False
        with self._conn() as conn:
            row = conn.execute(
                "SELECT 1 FROM publishers WHERE fingerprint=?", (fingerprint,)
            ).fetchone()
        return row is not None

    def add_trusted_publisher(
        self, fingerprint: str, name: str = "", email: str = "", trusted_by: str = "admin"
    ) -> None:
        with self._conn() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO publishers (fingerprint, name, email, trusted_at, trusted_by)
                VALUES (?, ?, ?, ?, ?)
                """,
                (fingerprint, name, email, datetime.now(tz=timezone.utc).isoformat(), trusted_by),
            )
