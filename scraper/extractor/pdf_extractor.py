"""PDF text extraction with pdfplumber primary and OCR fallback.

Standalone scraper module. NEVER imports from backend/app/.
Downloads PDFs via httpx, validates %PDF- magic bytes, extracts text with
pdfplumber, falls back to pdf2image + pytesseract OCR if text is blank or
>25% non-ASCII.

Slice S4b.1: alongside the linear `raw_text`, pdfplumber-backed extraction
also emits a `structured_content` block tree (heading / paragraph / list /
table) shaped to `backend.app.schemas.circulars.StructuredContent`. The
column it populates is `circular_documents.structured_content` (migration
006). Best-effort — OCR-only extractions skip structure and the renderer
falls back to plain prose.
"""

from __future__ import annotations

import random
import re
import statistics
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import httpx
import pdfplumber
import structlog
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

logger: structlog.stdlib.BoundLogger = structlog.get_logger("regpulse.extractor")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_DOWNLOAD_TIMEOUT = 15.0  # seconds
_TEMP_DIR = Path("/tmp/regpulse")  # noqa: S108
_NON_ASCII_THRESHOLD = 0.25  # 25% non-ASCII triggers OCR fallback
_PDF_MAGIC_BYTES = b"%PDF-"

# Rotating User-Agent pool (reuse from crawler)
_USER_AGENTS: list[str] = [
    (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15"
    ),
    (
        "Mozilla/5.0 (X11; Linux x86_64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
]

# Default max pages for OCR to bound runtime
DEFAULT_OCR_MAX_PAGES = 10

# --- Structural extraction tuning ---
# A line whose mean font-size is at least 1.15x the page median is treated as
# a heading. Sub-ratios assign heading depth (1 = biggest).
_HEADING_RATIO_L1 = 1.60
_HEADING_RATIO_L2 = 1.30
_HEADING_RATIO_L3 = 1.15

# Ordered list: "1.", "1.1", "2)", "(3)"; Unordered: bullet glyphs / dashes.
_ORDERED_PREFIX = re.compile(r"^(?:\(?\d+(?:\.\d+)*\)?[\.\)])\s+")
_UNORDERED_PREFIX = re.compile(r"^[•●○▪◦\-\*]\s+")


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------


@dataclass
class ExtractedDocument:
    """Result of PDF text extraction.

    `structured_content` is the JSONB-shaped block tree consumed by the v2
    `library/[id]` renderer. It is `None` for scanned/OCR docs where layout
    cannot be recovered, and the renderer falls back to linear text.
    """

    raw_text: str
    extraction_method: str  # "pdfplumber", "ocr", or "failed"
    page_count: int
    warnings: list[str] = field(default_factory=list)
    structured_content: dict[str, Any] | None = None


@dataclass
class ExtractionFailure:
    """Represents a failed extraction with reason for tracking."""

    url: str
    reason: str  # "not_pdf", "download_error", "extraction_error", "empty_after_ocr"


# ---------------------------------------------------------------------------
# PDFExtractor
# ---------------------------------------------------------------------------


class PDFExtractor:
    """Download and extract text from RBI PDF documents.

    Primary extraction via pdfplumber; OCR fallback (pdf2image + pytesseract)
    when text is blank or contains >25% non-ASCII characters.

    Key safety features:
    - Pre-validates %PDF- magic bytes before extraction (catches HTML pages)
    - Catches poppler exceptions per-document; logs + continues
    - OCR limited to configurable max pages to bound runtime
    """

    def __init__(self, *, ocr_max_pages: int = DEFAULT_OCR_MAX_PAGES) -> None:
        self._ocr_max_pages = ocr_max_pages

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    @retry(
        retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.TransportError)),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        stop=stop_after_attempt(3),
        reraise=True,
    )
    async def download(self, url: str) -> bytes:
        """Download a PDF from the given URL.

        Returns raw PDF bytes. Stores temp file at /tmp/regpulse/{uuid}.pdf.
        """
        _TEMP_DIR.mkdir(parents=True, exist_ok=True)
        file_id = uuid.uuid4()
        temp_path = _TEMP_DIR / f"{file_id}.pdf"

        headers = {
            "User-Agent": random.choice(_USER_AGENTS),  # noqa: S311
            "Accept": "application/pdf,*/*",
        }

        async with httpx.AsyncClient(
            timeout=_DOWNLOAD_TIMEOUT,
            follow_redirects=True,
        ) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()

        pdf_bytes = response.content
        temp_path.write_bytes(pdf_bytes)

        logger.info(
            "pdf_downloaded",
            url=url,
            size_bytes=len(pdf_bytes),
            temp_path=str(temp_path),
        )
        return pdf_bytes

    @staticmethod
    def validate_pdf_bytes(pdf_bytes: bytes) -> bool:
        """Check if bytes start with %PDF- magic marker.

        Returns True if valid PDF, False otherwise. This catches the most
        common failure mode: HTML pages served instead of PDFs.
        """
        if not pdf_bytes or len(pdf_bytes) < 5:
            return False
        return pdf_bytes[:5] == _PDF_MAGIC_BYTES

    def extract_pdfplumber(self, pdf_bytes: bytes) -> tuple[str, int]:
        """Extract linear text from PDF bytes using pdfplumber.

        Returns (extracted_text, page_count). Inserts page markers between pages.
        Backward-compatible: callers that don't need the structural tree keep
        this two-tuple shape. Use `extract_pdfplumber_full` for both outputs.
        """
        text, page_count, _ = self.extract_pdfplumber_full(pdf_bytes)
        return text, page_count

    def extract_pdfplumber_full(
        self, pdf_bytes: bytes
    ) -> tuple[str, int, list[dict[str, Any]]]:
        """Extract both linear text AND the structured-content block tree.

        Returns (extracted_text, page_count, blocks). `blocks` matches the
        `StructuredContent.blocks` shape in the backend schema. On per-page
        structural-extraction errors, that page's blocks are skipped but the
        linear text is preserved.
        """
        pages_text: list[str] = []
        blocks: list[dict[str, Any]] = []
        page_count = 0

        with pdfplumber.open(_bytes_to_tmp_file(pdf_bytes)) as pdf:
            page_count = len(pdf.pages)
            for i, page in enumerate(pdf.pages, start=1):
                text = page.extract_text() or ""
                pages_text.append(f"--- Page {i} ---\n{text}")
                try:
                    blocks.extend(_blocks_from_page(page))
                except Exception as exc:  # noqa: BLE001 — best-effort
                    logger.warning(
                        "structured_page_failed",
                        page=i,
                        error=str(exc),
                    )

        full_text = "\n\n".join(pages_text)
        merged = _merge_blocks(blocks)
        logger.info(
            "pdfplumber_extraction",
            page_count=page_count,
            text_length=len(full_text),
            block_count=len(merged),
        )
        return full_text, page_count, merged

    def extract_ocr(self, pdf_bytes: bytes, *, max_pages: int | None = None) -> tuple[str, int]:
        """Extract text from PDF bytes using OCR (pdf2image + pytesseract).

        Returns (extracted_text, page_count).
        Raises RuntimeError if pdf2image/poppler is not available.

        Args:
            max_pages: Maximum number of pages to OCR. Defaults to
                       self._ocr_max_pages.
        """
        try:
            from pdf2image import convert_from_bytes
        except ImportError as exc:
            raise RuntimeError(
                "pdf2image not installed or poppler missing — OCR fallback unavailable"
            ) from exc

        import pytesseract

        effective_max = max_pages if max_pages is not None else self._ocr_max_pages

        images = convert_from_bytes(pdf_bytes)
        total_page_count = len(images)

        # Limit pages to OCR to bound runtime
        if effective_max and len(images) > effective_max:
            logger.warning(
                "ocr_page_limit_applied",
                total_pages=total_page_count,
                max_pages=effective_max,
            )
            images = images[:effective_max]

        pages_text: list[str] = []
        for i, image in enumerate(images, start=1):
            text = pytesseract.image_to_string(image, lang="eng")
            pages_text.append(f"--- Page {i} ---\n{text}")

        full_text = "\n\n".join(pages_text)
        logger.info(
            "ocr_extraction",
            page_count=total_page_count,
            pages_ocrd=len(images),
            text_length=len(full_text),
        )
        return full_text, total_page_count

    async def extract(self, url: str) -> ExtractedDocument:
        """Download PDF and extract text. Try pdfplumber first; fall back to OCR.

        Pre-validates %PDF- magic bytes. Returns a failed ExtractedDocument
        (empty text) for non-PDF content instead of crashing.

        OCR fallback triggers when:
        - pdfplumber returns blank/empty text
        - Extracted text has >25% non-ASCII characters (scanned PDF artifact)
        """
        warnings: list[str] = []

        try:
            # Step 1: Download
            try:
                pdf_bytes = await self.download(url)
            except (httpx.HTTPStatusError, httpx.TransportError) as exc:
                logger.warning("pdf_download_failed", url=url, error=str(exc))
                return ExtractedDocument(
                    raw_text="",
                    extraction_method="failed",
                    page_count=0,
                    warnings=[f"Download failed: {exc}"],
                )

            # Step 2: Validate magic bytes — this is the key guard against
            # HTML pages, .aspx responses, and other non-PDF content.
            if not self.validate_pdf_bytes(pdf_bytes):
                # Log a snippet of what we actually got for debugging
                preview = pdf_bytes[:100].decode("utf-8", errors="replace")
                logger.warning(
                    "pdf_magic_bytes_invalid",
                    url=url,
                    preview=preview[:80],
                    content_length=len(pdf_bytes),
                )
                return ExtractedDocument(
                    raw_text="",
                    extraction_method="failed",
                    page_count=0,
                    warnings=[
                        f"Not a valid PDF (missing %PDF- header). " f"Got: {preview[:40]}..."
                    ],
                )

            # Step 3: Primary extraction via pdfplumber — both linear text
            # and the structural block tree come from one pass.
            structured_blocks: list[dict[str, Any]] = []
            try:
                raw_text, page_count, structured_blocks = self.extract_pdfplumber_full(
                    pdf_bytes
                )
            except Exception as exc:
                warnings.append(f"pdfplumber failed: {exc}")
                logger.warning(
                    "pdfplumber_extraction_failed",
                    url=url,
                    error=str(exc),
                )
                raw_text = ""
                page_count = 0

            # Step 4: Decide if OCR is needed
            needs_ocr = False
            stripped = raw_text.replace("--- Page", "").strip()

            if not stripped:
                needs_ocr = True
                warnings.append("pdfplumber returned blank text — trying OCR")
            elif _non_ascii_ratio(stripped) > _NON_ASCII_THRESHOLD:
                needs_ocr = True
                warnings.append(
                    f"pdfplumber text has >{_NON_ASCII_THRESHOLD * 100:.0f}% "
                    "non-ASCII — trying OCR"
                )

            # Step 5: OCR fallback
            if needs_ocr:
                try:
                    raw_text, page_count = self.extract_ocr(pdf_bytes)
                    extraction_method = "ocr"
                except RuntimeError as exc:
                    warnings.append(str(exc))
                    extraction_method = "pdfplumber"
                except Exception as exc:
                    warnings.append(f"OCR fallback failed: {exc}")
                    logger.warning(
                        "ocr_fallback_failed",
                        url=url,
                        error=str(exc),
                    )
                    extraction_method = "pdfplumber"
            else:
                extraction_method = "pdfplumber"

            logger.info(
                "extraction_complete",
                url=url,
                method=extraction_method,
                page_count=page_count,
                text_length=len(raw_text),
                warnings=warnings,
            )

            # OCR path can't recover layout — structured_content stays None
            # and the renderer falls back to linear-text display.
            structured_content: dict[str, Any] | None = None
            if extraction_method == "pdfplumber" and structured_blocks:
                structured_content = {"version": 1, "blocks": structured_blocks}

            return ExtractedDocument(
                raw_text=raw_text,
                extraction_method=extraction_method,
                page_count=page_count,
                warnings=warnings,
                structured_content=structured_content,
            )

        except Exception as exc:
            # Catch-all: never crash the entire scraper run for one document.
            logger.error(
                "extraction_unexpected_error",
                url=url,
                error=str(exc),
                exc_info=True,
            )
            return ExtractedDocument(
                raw_text="",
                extraction_method="failed",
                page_count=0,
                warnings=[f"Unexpected extraction error: {exc}"],
            )

        finally:
            # Clean up temp files
            _cleanup_temp_dir()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _bytes_to_tmp_file(pdf_bytes: bytes) -> Path:
    """Write PDF bytes to a temp file and return the path."""
    _TEMP_DIR.mkdir(parents=True, exist_ok=True)
    tmp_path = _TEMP_DIR / f"{uuid.uuid4()}.pdf"
    tmp_path.write_bytes(pdf_bytes)
    return tmp_path


def _non_ascii_ratio(text: str) -> float:
    """Calculate the ratio of non-ASCII characters in text."""
    if not text:
        return 0.0
    non_ascii = sum(1 for c in text if ord(c) > 127)
    return non_ascii / len(text)


def _cleanup_temp_dir() -> None:
    """Remove all .pdf files in /tmp/regpulse/ older than current session."""
    try:
        if _TEMP_DIR.exists():
            for f in _TEMP_DIR.glob("*.pdf"):
                try:
                    f.unlink()
                except OSError:
                    pass
    except OSError:
        pass


# ---------------------------------------------------------------------------
# Structural extraction (S4b.1)
# ---------------------------------------------------------------------------


def _blocks_from_page(page: Any) -> list[dict[str, Any]]:
    """Emit raw blocks for one pdfplumber page in document order.

    Tables and text lines are sorted by their Y position so a table appears
    in the output between the lines that surround it. Output is pre-merge:
    paragraphs come out one-per-line, list items as `list_item_*`.
    `_merge_blocks` collapses adjacent paragraphs and groups list items.
    """
    median = _page_median_font_size(page)

    # Collect tables (each carries a bbox we both emit and use to skip
    # text lines that fall inside).
    try:
        tables = page.find_tables() or []
    except Exception:  # noqa: BLE001 — pdfplumber edge cases
        tables = []

    table_bboxes: list[tuple[float, float, float, float]] = []
    table_blocks: list[tuple[float, dict[str, Any]]] = []  # (y_top, block)
    for tbl in tables:
        try:
            rows = tbl.extract()
        except Exception:  # noqa: BLE001
            continue
        if not rows:
            continue
        headers = [_cell(c) for c in rows[0]]
        data_rows = [[_cell(c) for c in r] for r in rows[1:]]
        if not (any(headers) or data_rows):
            continue
        bbox = tuple(tbl.bbox)
        table_bboxes.append(bbox)
        table_blocks.append(
            (float(bbox[1]), {"type": "table", "headers": headers, "rows": data_rows})
        )

    # Text lines.
    try:
        lines = page.extract_text_lines() or []
    except Exception:  # noqa: BLE001
        return [block for _, block in sorted(table_blocks, key=lambda t: t[0])]

    line_blocks: list[tuple[float, dict[str, Any]]] = []
    for line in lines:
        if _line_in_any_bbox(line, table_bboxes):
            continue
        text = (line.get("text") or "").strip()
        if not text:
            continue

        size = _line_font_size(line, fallback=median)
        y = float(line.get("top") or 0.0)

        if median > 0 and size >= median * _HEADING_RATIO_L3:
            level = _heading_level(size, median)
            line_blocks.append((y, {"type": "heading", "level": level, "text": text}))
            continue

        if _ORDERED_PREFIX.match(text):
            line_blocks.append(
                (
                    y,
                    {
                        "type": "list_item_ordered",
                        "text": _ORDERED_PREFIX.sub("", text, count=1),
                    },
                )
            )
            continue

        if _UNORDERED_PREFIX.match(text):
            line_blocks.append(
                (
                    y,
                    {
                        "type": "list_item_unordered",
                        "text": _UNORDERED_PREFIX.sub("", text, count=1),
                    },
                )
            )
            continue

        line_blocks.append((y, {"type": "paragraph", "text": text}))

    combined = table_blocks + line_blocks
    combined.sort(key=lambda t: t[0])
    return [block for _, block in combined]


def _merge_blocks(raw: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Merge adjacent paragraph lines + collect list items into list blocks.

    Schema-clean: every output block matches one of the four
    `StructuredBlock` shapes in `backend/app/schemas/circulars.py`.
    """
    out: list[dict[str, Any]] = []
    para_buf: list[str] = []
    list_items: list[dict[str, Any]] = []
    list_ordered: bool | None = None  # None = not in a list

    def flush_para() -> None:
        if para_buf:
            out.append({"type": "paragraph", "text": " ".join(para_buf)})
            para_buf.clear()

    def flush_list() -> None:
        nonlocal list_ordered
        if list_items:
            out.append(
                {
                    "type": "list",
                    "ordered": bool(list_ordered),
                    "items": [
                        {"type": "paragraph", "text": it["text"]} for it in list_items
                    ],
                }
            )
            list_items.clear()
        list_ordered = None

    for b in raw:
        t = b["type"]
        if t in ("heading", "table"):
            flush_para()
            flush_list()
            out.append(b)
        elif t == "paragraph":
            flush_list()
            para_buf.append(b["text"])
        elif t == "list_item_ordered":
            flush_para()
            if list_ordered is False:
                flush_list()
            list_ordered = True
            list_items.append(b)
        elif t == "list_item_unordered":
            flush_para()
            if list_ordered is True:
                flush_list()
            list_ordered = False
            list_items.append(b)

    flush_para()
    flush_list()
    return out


def _cell(value: Any) -> str:
    return "" if value is None else str(value).strip()


def _page_median_font_size(page: Any) -> float:
    """Median font size across all chars on a page; 0 if unavailable."""
    try:
        sizes = [float(c["size"]) for c in (page.chars or []) if "size" in c]
    except Exception:  # noqa: BLE001
        return 0.0
    return statistics.median(sizes) if sizes else 0.0


def _line_font_size(line: dict[str, Any], *, fallback: float) -> float:
    """Mean font size of the chars in a pdfplumber line; falls back to median."""
    chars = line.get("chars") or []
    sizes = [float(c["size"]) for c in chars if "size" in c]
    if not sizes:
        return fallback
    return sum(sizes) / len(sizes)


def _heading_level(size: float, median: float) -> int:
    """Map font-size delta to a 1/2/3 heading depth."""
    if median <= 0:
        return 3
    ratio = size / median
    if ratio >= _HEADING_RATIO_L1:
        return 1
    if ratio >= _HEADING_RATIO_L2:
        return 2
    return 3


def _line_in_any_bbox(
    line: dict[str, Any], bboxes: list[tuple[float, float, float, float]]
) -> bool:
    """True if the line's vertical span sits inside any table bbox."""
    if not bboxes:
        return False
    top = line.get("top")
    bottom = line.get("bottom")
    if top is None or bottom is None:
        return False
    for x0, b_top, x1, b_bottom in bboxes:
        if top >= b_top and bottom <= b_bottom:
            return True
    return False
