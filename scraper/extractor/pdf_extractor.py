"""PDF text extraction with pdfplumber primary and OCR fallback.

Standalone scraper module. NEVER imports from backend/app/.
Downloads PDFs via httpx, extracts text with pdfplumber, falls back to
pdf2image + pytesseract OCR if text is blank or >25% non-ASCII.
"""

from __future__ import annotations

import random
import uuid
from dataclasses import dataclass, field
from pathlib import Path

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


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------


@dataclass
class ExtractedDocument:
    """Result of PDF text extraction."""

    raw_text: str
    extraction_method: str  # "pdfplumber" or "ocr"
    page_count: int
    warnings: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# PDFExtractor
# ---------------------------------------------------------------------------


class PDFExtractor:
    """Download and extract text from RBI PDF documents.

    Primary extraction via pdfplumber; OCR fallback (pdf2image + pytesseract)
    when text is blank or contains >25% non-ASCII characters.
    """

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

    def extract_pdfplumber(self, pdf_bytes: bytes) -> tuple[str, int]:
        """Extract text from PDF bytes using pdfplumber.

        Returns (extracted_text, page_count). Inserts page markers between pages.
        """
        pages_text: list[str] = []
        page_count = 0

        with pdfplumber.open(_bytes_to_tmp_file(pdf_bytes)) as pdf:
            page_count = len(pdf.pages)
            for i, page in enumerate(pdf.pages, start=1):
                text = page.extract_text() or ""
                pages_text.append(f"--- Page {i} ---\n{text}")

        full_text = "\n\n".join(pages_text)
        logger.info(
            "pdfplumber_extraction",
            page_count=page_count,
            text_length=len(full_text),
        )
        return full_text, page_count

    def extract_ocr(self, pdf_bytes: bytes) -> tuple[str, int]:
        """Extract text from PDF bytes using OCR (pdf2image + pytesseract).

        Returns (extracted_text, page_count).
        Raises RuntimeError if pdf2image/poppler is not available.
        """
        try:
            from pdf2image import convert_from_bytes
        except ImportError as exc:
            raise RuntimeError(
                "pdf2image not installed or poppler missing — OCR fallback unavailable"
            ) from exc

        import pytesseract

        images = convert_from_bytes(pdf_bytes)
        page_count = len(images)
        pages_text: list[str] = []

        for i, image in enumerate(images, start=1):
            text = pytesseract.image_to_string(image, lang="eng")
            pages_text.append(f"--- Page {i} ---\n{text}")

        full_text = "\n\n".join(pages_text)
        logger.info(
            "ocr_extraction",
            page_count=page_count,
            text_length=len(full_text),
        )
        return full_text, page_count

    async def extract(self, url: str) -> ExtractedDocument:
        """Download PDF and extract text. Try pdfplumber first; fall back to OCR.

        OCR fallback triggers when:
        - pdfplumber returns blank/empty text
        - Extracted text has >25% non-ASCII characters (scanned PDF artifact)
        """
        warnings: list[str] = []
        temp_files: list[Path] = []

        try:
            pdf_bytes = await self.download(url)

            # Primary: pdfplumber
            try:
                raw_text, page_count = self.extract_pdfplumber(pdf_bytes)
            except Exception as exc:
                warnings.append(f"pdfplumber failed: {exc}")
                raw_text = ""
                page_count = 0

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

            if needs_ocr:
                try:
                    raw_text, page_count = self.extract_ocr(pdf_bytes)
                    extraction_method = "ocr"
                except RuntimeError as exc:
                    warnings.append(str(exc))
                    extraction_method = "pdfplumber"
                except Exception as exc:
                    warnings.append(f"OCR fallback failed: {exc}")
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

            return ExtractedDocument(
                raw_text=raw_text,
                extraction_method=extraction_method,
                page_count=page_count,
                warnings=warnings,
            )

        finally:
            # Clean up temp files
            _cleanup_temp_files(temp_files)
            # Also clean any files created during this extraction in /tmp/regpulse/
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


def _cleanup_temp_files(paths: list[Path]) -> None:
    """Remove specific temp files."""
    for p in paths:
        try:
            if p.exists():
                p.unlink()
        except OSError:
            pass


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
