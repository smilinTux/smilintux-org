"""Tests for the PMA agreement PDF template generator."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
from generate_pma_agreement import PMADocument, build_agreement


class TestPMADocument:
    """Tests for the PMADocument class."""

    def test_document_creates(self):
        pdf = PMADocument()
        assert pdf is not None

    def test_margins_set(self):
        pdf = PMADocument()
        assert pdf.l_margin == PMADocument.MARGIN
        assert pdf.r_margin == PMADocument.MARGIN


class TestBuildAgreement:
    """Tests for the build_agreement function."""

    def test_generates_pdf(self, tmp_path):
        out = tmp_path / "test-agreement.pdf"
        result = build_agreement(str(out))
        assert result.exists()
        assert result.stat().st_size > 10000

    def test_pdf_has_content(self, tmp_path):
        out = tmp_path / "test.pdf"
        build_agreement(str(out))
        raw = out.read_bytes()
        assert raw[:5] == b"%PDF-"

    def test_creates_parent_directories(self, tmp_path):
        out = tmp_path / "nested" / "dir" / "agreement.pdf"
        result = build_agreement(str(out))
        assert result.exists()

    def test_pdf_has_multiple_pages(self, tmp_path):
        out = tmp_path / "pages.pdf"
        build_agreement(str(out))
        raw = out.read_bytes()
        page_count = raw.count(b"/Type /Page")
        assert page_count >= 4, f"Expected 4+ pages, got {page_count}"
