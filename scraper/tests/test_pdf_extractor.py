"""Tests for scraper/extractor/pdf_extractor.py

Three test cases as specified:
(i)   Good PDF → text extracted via pdfplumber
(ii)  Scanned PDF → OCR fallback path
(iii) Malformed/non-PDF → graceful skip (no crash)
"""

from __future__ import annotations

import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from scraper.extractor.pdf_extractor import (
    ExtractedDocument,
    PDFExtractor,
    _blocks_from_page,
    _merge_blocks,
    _non_ascii_ratio,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture
def extractor() -> PDFExtractor:
    return PDFExtractor(ocr_max_pages=5)


@pytest.fixture
def good_pdf_bytes() -> bytes:
    return (FIXTURES_DIR / "good_sample.pdf").read_bytes()


@pytest.fixture
def html_not_pdf_bytes() -> bytes:
    return (FIXTURES_DIR / "html_not_pdf.pdf").read_bytes()


@pytest.fixture
def scanned_pdf_bytes() -> bytes:
    return (FIXTURES_DIR / "scanned_sample.pdf").read_bytes()


@pytest.fixture
def real_rbi_pdf_bytes() -> bytes:
    """Use the actual RBI test PDF if available."""
    rbi_pdf = Path(__file__).parent.parent / "test_RBI.pdf"
    if rbi_pdf.exists():
        return rbi_pdf.read_bytes()
    pytest.skip("test_RBI.pdf not available")


# ---------------------------------------------------------------------------
# Helper tests
# ---------------------------------------------------------------------------


class TestNonAsciiRatio:
    def test_empty_string(self) -> None:
        assert _non_ascii_ratio("") == 0.0

    def test_all_ascii(self) -> None:
        assert _non_ascii_ratio("Hello World") == 0.0

    def test_mixed(self) -> None:
        ratio = _non_ascii_ratio("Hello\u00e9\u00e8")
        assert ratio == pytest.approx(2 / 7)

    def test_all_non_ascii(self) -> None:
        assert _non_ascii_ratio("\u00e9\u00e8\u00ea") == 1.0


# ---------------------------------------------------------------------------
# validate_pdf_bytes tests
# ---------------------------------------------------------------------------


class TestValidatePdfBytes:
    def test_valid_pdf_magic(self, extractor: PDFExtractor) -> None:
        assert extractor.validate_pdf_bytes(b"%PDF-1.4 some content")

    def test_html_content_rejected(self, extractor: PDFExtractor) -> None:
        assert not extractor.validate_pdf_bytes(b"<!DOCTYPE html>")

    def test_empty_bytes_rejected(self, extractor: PDFExtractor) -> None:
        assert not extractor.validate_pdf_bytes(b"")

    def test_short_bytes_rejected(self, extractor: PDFExtractor) -> None:
        assert not extractor.validate_pdf_bytes(b"%PD")

    def test_real_pdf_fixture(self, extractor: PDFExtractor, good_pdf_bytes: bytes) -> None:
        assert extractor.validate_pdf_bytes(good_pdf_bytes)

    def test_html_fixture(self, extractor: PDFExtractor, html_not_pdf_bytes: bytes) -> None:
        assert not extractor.validate_pdf_bytes(html_not_pdf_bytes)


# ---------------------------------------------------------------------------
# Case (i): Good PDF → text extracted
# ---------------------------------------------------------------------------


class TestGoodPdfExtraction:
    def test_pdfplumber_extracts_text(self, extractor: PDFExtractor, good_pdf_bytes: bytes) -> None:
        text, page_count = extractor.extract_pdfplumber(good_pdf_bytes)
        assert page_count >= 1
        # The fixture PDF has "Hello RBI KYC" text
        assert "Hello" in text or "RBI" in text or len(text) > 0

    def test_real_rbi_pdf_extracts_text(
        self, extractor: PDFExtractor, real_rbi_pdf_bytes: bytes
    ) -> None:
        text, page_count = extractor.extract_pdfplumber(real_rbi_pdf_bytes)
        assert page_count >= 1
        assert len(text) > 100  # Real PDF should have substantial text

    def test_extract_full_pipeline_good_pdf(
        self, extractor: PDFExtractor, good_pdf_bytes: bytes
    ) -> None:
        """Full extract() pipeline with a good PDF — mock the download step."""

        async def _run() -> ExtractedDocument:
            with patch.object(extractor, "download", new_callable=AsyncMock) as mock_dl:
                mock_dl.return_value = good_pdf_bytes
                return await extractor.extract("https://example.com/good.pdf")

        result = asyncio.run(_run())
        assert result.extraction_method in ("pdfplumber", "ocr")
        assert result.page_count >= 1


# ---------------------------------------------------------------------------
# Case (ii): Scanned PDF → OCR fallback
# ---------------------------------------------------------------------------


class TestScannedPdfOcrFallback:
    def test_blank_pdfplumber_triggers_ocr(
        self, extractor: PDFExtractor, scanned_pdf_bytes: bytes
    ) -> None:
        """When pdfplumber returns blank text, extract() should try OCR."""

        async def _run() -> ExtractedDocument:
            with patch.object(extractor, "download", new_callable=AsyncMock) as mock_dl:
                mock_dl.return_value = scanned_pdf_bytes
                # Mock pdfplumber's structural-aware extractor to return blank.
                with patch.object(extractor, "extract_pdfplumber_full") as mock_plumber:
                    mock_plumber.return_value = ("", 1, [])
                    # Mock OCR to return something
                    with patch.object(extractor, "extract_ocr") as mock_ocr:
                        mock_ocr.return_value = ("OCR extracted text content", 1)
                        return await extractor.extract("https://example.com/scan.pdf")

        result = asyncio.run(_run())
        assert result.extraction_method == "ocr"
        assert "OCR" in result.raw_text
        assert any("blank" in w.lower() or "ocr" in w.lower() for w in result.warnings)
        assert result.structured_content is None  # OCR path skips structure

    def test_ocr_page_limit(self, extractor: PDFExtractor) -> None:
        """OCR should respect the max_pages limit."""
        limited_extractor = PDFExtractor(ocr_max_pages=2)

        # Create mock images
        mock_images = [MagicMock() for _ in range(5)]

        with patch("scraper.extractor.pdf_extractor.pdfplumber"):
            with patch("pdf2image.convert_from_bytes", return_value=mock_images):
                with patch("pytesseract.image_to_string", return_value="page text"):
                    text, page_count = limited_extractor.extract_ocr(b"%PDF-1.4 fake")
                    # Should have only OCR'd 2 pages despite 5 available
                    assert page_count == 5  # total count
                    assert text.count("--- Page") == 2

    def test_ocr_runtime_error_handled(
        self, extractor: PDFExtractor, scanned_pdf_bytes: bytes
    ) -> None:
        """When OCR deps are missing, graceful fallback."""

        async def _run() -> ExtractedDocument:
            with patch.object(extractor, "download", new_callable=AsyncMock) as mock_dl:
                mock_dl.return_value = scanned_pdf_bytes
                # Mock pdfplumber to return blank to trigger OCR path
                with patch.object(extractor, "extract_pdfplumber_full") as mock_plumber:
                    mock_plumber.return_value = ("", 1, [])
                    with patch.object(extractor, "extract_ocr") as mock_ocr:
                        mock_ocr.side_effect = RuntimeError("pdf2image not installed")
                        return await extractor.extract("https://example.com/scan.pdf")

        result = asyncio.run(_run())
        # Should not crash — returns whatever pdfplumber gave us
        assert result.extraction_method == "pdfplumber"
        assert any("pdf2image" in w for w in result.warnings)


# ---------------------------------------------------------------------------
# Case (iii): Malformed / non-PDF → graceful skip
# ---------------------------------------------------------------------------


class TestMalformedGracefulSkip:
    def test_html_content_rejected(
        self, extractor: PDFExtractor, html_not_pdf_bytes: bytes
    ) -> None:
        """HTML content served as 'PDF' should be rejected without crashing."""

        async def _run() -> ExtractedDocument:
            with patch.object(extractor, "download", new_callable=AsyncMock) as mock_dl:
                mock_dl.return_value = html_not_pdf_bytes
                return await extractor.extract("https://www.rbi.org.in/scripts/ScreenReader.aspx")

        result = asyncio.run(_run())
        assert result.raw_text == ""
        assert result.extraction_method == "failed"
        assert result.page_count == 0
        assert any("%PDF-" in w or "Not a valid PDF" in w for w in result.warnings)

    def test_empty_bytes_rejected(self, extractor: PDFExtractor) -> None:
        """Empty download should be rejected."""

        async def _run() -> ExtractedDocument:
            with patch.object(extractor, "download", new_callable=AsyncMock) as mock_dl:
                mock_dl.return_value = b""
                return await extractor.extract("https://example.com/empty.pdf")

        result = asyncio.run(_run())
        assert result.raw_text == ""
        assert result.extraction_method == "failed"

    def test_download_failure_handled(self, extractor: PDFExtractor) -> None:
        """HTTP errors during download should return failed, not crash."""

        async def _run() -> ExtractedDocument:
            with patch.object(extractor, "download", new_callable=AsyncMock) as mock_dl:
                mock_dl.side_effect = Exception("Connection refused")
                return await extractor.extract("https://example.com/bad.pdf")

        result = asyncio.run(_run())
        assert result.raw_text == ""
        assert result.extraction_method == "failed"

    def test_aspx_url_content_rejected(self, extractor: PDFExtractor) -> None:
        """Typical RBI .aspx page served as response — the main SCR-1 failure mode."""
        aspx_content = (
            b'<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"'
            b' "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">'
            b"<html><head><title>RBI</title></head><body>"
            b"<h1>Screen Reader Access</h1></body></html>"
        )

        async def _run() -> ExtractedDocument:
            with patch.object(extractor, "download", new_callable=AsyncMock) as mock_dl:
                mock_dl.return_value = aspx_content
                return await extractor.extract("https://www.rbi.org.in/scripts/ScreenReader.aspx")

        result = asyncio.run(_run())
        assert result.raw_text == ""
        assert result.extraction_method == "failed"
        assert result.page_count == 0


# ---------------------------------------------------------------------------
# Case (iv): Structural extraction — S4b.1
#
# These tests exercise the block-tree emission via mock pdfplumber Page
# objects. They avoid any real PDF parsing so they stay fast and
# deterministic on CI without poppler/tesseract.
# ---------------------------------------------------------------------------


def _line(text: str, *, size: float, top: float = 100.0, bottom: float = 112.0) -> dict:
    """Build a pdfplumber-shaped line dict with one synthetic char."""
    return {
        "text": text,
        "top": top,
        "bottom": bottom,
        "chars": [{"size": size}] * max(len(text), 1),
    }


def _mock_page(
    *,
    lines: list[dict],
    median_size: float = 10.0,
    tables: list | None = None,
) -> MagicMock:
    """Build a pdfplumber.Page-shaped mock for structural extraction tests."""
    page = MagicMock()
    page.chars = [{"size": median_size}] * 20  # drives _page_median_font_size
    page.extract_text_lines.return_value = lines
    page.find_tables.return_value = tables or []
    return page


class TestStructuredBlocks:
    """_blocks_from_page + _merge_blocks unit coverage."""

    def test_paragraph_lines_merge(self) -> None:
        page = _mock_page(
            lines=[
                _line("This circular sets out the revised provisioning norms", size=10),
                _line("for non-banking financial companies effective Q1 FY26.", size=10),
            ]
        )
        blocks = _merge_blocks(_blocks_from_page(page))
        assert blocks == [
            {
                "type": "paragraph",
                "text": (
                    "This circular sets out the revised provisioning norms "
                    "for non-banking financial companies effective Q1 FY26."
                ),
            }
        ]

    def test_heading_detected_by_font_size_delta(self) -> None:
        page = _mock_page(
            lines=[
                _line("CHAPTER I. PRELIMINARY", size=16),
                _line("These directions apply to all scheduled banks.", size=10),
            ]
        )
        blocks = _merge_blocks(_blocks_from_page(page))
        assert blocks[0]["type"] == "heading"
        assert blocks[0]["level"] == 1
        assert blocks[0]["text"] == "CHAPTER I. PRELIMINARY"
        assert blocks[1]["type"] == "paragraph"

    def test_heading_levels_map_to_size_buckets(self) -> None:
        # L1 ≥ 1.60x, L2 ≥ 1.30x, L3 ≥ 1.15x, body < 1.15x median (10).
        page = _mock_page(
            lines=[
                _line("Big Title", size=18),  # 1.80x → L1
                _line("Medium Title", size=14),  # 1.40x → L2
                _line("Small Title", size=12),  # 1.20x → L3
                _line("Body text follows.", size=10),
            ]
        )
        levels = [
            b["level"]
            for b in _merge_blocks(_blocks_from_page(page))
            if b["type"] == "heading"
        ]
        assert levels == [1, 2, 3]

    def test_ordered_list_grouping(self) -> None:
        page = _mock_page(
            lines=[
                _line("1. First requirement applies to KYC.", size=10),
                _line("2. Second requirement applies to AML.", size=10),
                _line("3. Third requirement applies to CFT.", size=10),
            ]
        )
        blocks = _merge_blocks(_blocks_from_page(page))
        assert len(blocks) == 1
        assert blocks[0]["type"] == "list"
        assert blocks[0]["ordered"] is True
        assert len(blocks[0]["items"]) == 3
        assert blocks[0]["items"][0]["text"] == "First requirement applies to KYC."

    def test_unordered_list_grouping(self) -> None:
        page = _mock_page(
            lines=[
                _line("• Bullet alpha", size=10),
                _line("• Bullet beta", size=10),
            ]
        )
        blocks = _merge_blocks(_blocks_from_page(page))
        assert blocks == [
            {
                "type": "list",
                "ordered": False,
                "items": [
                    {"type": "paragraph", "text": "Bullet alpha"},
                    {"type": "paragraph", "text": "Bullet beta"},
                ],
            }
        ]

    def test_list_type_switch_starts_new_block(self) -> None:
        # Ordered → unordered → must emit two distinct list blocks.
        page = _mock_page(
            lines=[
                _line("1. Item alpha", size=10),
                _line("• Bullet beta", size=10),
            ]
        )
        blocks = _merge_blocks(_blocks_from_page(page))
        kinds = [b["type"] for b in blocks]
        ordering = [b.get("ordered") for b in blocks if b["type"] == "list"]
        assert kinds == ["list", "list"]
        assert ordering == [True, False]

    def test_table_emitted_and_lines_inside_bbox_skipped(self) -> None:
        # Table at y=200..240; a paragraph line at y=220 must be skipped
        # because it falls inside the table bbox.
        tbl = MagicMock()
        tbl.bbox = (50.0, 200.0, 500.0, 240.0)
        tbl.extract.return_value = [
            ["Category", "Limit"],
            ["Retail", "₹50,000"],
            ["Corporate", "₹5,00,000"],
        ]
        page = _mock_page(
            lines=[
                _line("Heading above table", size=14, top=100, bottom=112),
                _line("Retail ₹50,000 Corporate ₹5,00,000", size=10, top=220, bottom=230),
                _line("Caption below table.", size=10, top=260, bottom=272),
            ],
            tables=[tbl],
        )
        blocks = _merge_blocks(_blocks_from_page(page))
        types = [b["type"] for b in blocks]
        # heading + table + paragraph(caption) — line inside bbox is skipped.
        assert types == ["heading", "table", "paragraph"]
        table_block = blocks[1]
        assert table_block["headers"] == ["Category", "Limit"]
        assert table_block["rows"] == [
            ["Retail", "₹50,000"],
            ["Corporate", "₹5,00,000"],
        ]

    def test_empty_lines_skipped(self) -> None:
        page = _mock_page(
            lines=[
                _line("   ", size=10),
                _line("", size=10),
                _line("Real content.", size=10),
            ]
        )
        blocks = _merge_blocks(_blocks_from_page(page))
        assert blocks == [{"type": "paragraph", "text": "Real content."}]

    def test_block_shape_matches_StructuredContent(self) -> None:
        """Emitted block dicts use only the keys declared in StructuredBlock.

        Asserts shape inline to keep scraper tests free of backend imports
        (the cross-package coupling violates the spirit of CLAUDE.md rule 2).
        """
        allowed_keys = {"type", "text", "level", "ordered", "items", "headers", "rows"}
        valid_types = {"heading", "paragraph", "list", "table"}

        page = _mock_page(
            lines=[
                _line("TITLE", size=18),
                _line("Intro paragraph.", size=10),
                _line("1. First item.", size=10),
                _line("2. Second item.", size=10),
            ]
        )
        blocks = _merge_blocks(_blocks_from_page(page))

        kinds = [b["type"] for b in blocks]
        assert kinds == ["heading", "paragraph", "list"]

        def _check(block: dict) -> None:
            assert block["type"] in valid_types
            assert set(block.keys()) <= allowed_keys
            if block["type"] == "list":
                for it in block["items"]:
                    _check(it)

        for b in blocks:
            _check(b)

        # Spot-check the list block.
        list_block = blocks[2]
        assert list_block["ordered"] is True
        assert len(list_block["items"]) == 2


class TestExtractPdfplumberFull:
    """Smoke test of the public method end-to-end on the good PDF fixture."""

    def test_returns_three_tuple_with_blocks(
        self, extractor: PDFExtractor, good_pdf_bytes: bytes
    ) -> None:
        text, page_count, blocks = extractor.extract_pdfplumber_full(good_pdf_bytes)
        # Good PDF has linear text and at least one block (whatever the fixture is).
        assert isinstance(text, str) and text.strip()
        assert page_count >= 1
        assert isinstance(blocks, list)  # may be empty if fixture has no detectable structure
