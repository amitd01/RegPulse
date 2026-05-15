"""RBI website crawler — discovers new circular/notification/direction URLs.

Standalone scraper module. NEVER imports from backend/app/.
Uses httpx async client with rotating User-Agents, robots.txt compliance,
1–2s random delay between requests, and tenacity retry on failures.
"""

from __future__ import annotations

import asyncio
import random
import urllib.robotparser
from dataclasses import dataclass, field
from datetime import datetime
from typing import ClassVar
from urllib.parse import urljoin

import httpx
import structlog
from bs4 import BeautifulSoup
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

logger: structlog.stdlib.BoundLogger = structlog.get_logger("regpulse.crawler")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_RBI_BASE_URL = "https://www.rbi.org.in"

# Sections to crawl — maps human-readable name to RBI listing URL
RBI_SECTIONS: dict[str, str] = {
    "Notifications": f"{_RBI_BASE_URL}/Scripts/NotificationUser.aspx",
    "Master Directions": f"{_RBI_BASE_URL}/Scripts/BS_ViewMasterDirections.aspx",
    "Press Releases": f"{_RBI_BASE_URL}/Scripts/BS_PressReleaseDisplay.aspx",
    "FAQs": f"{_RBI_BASE_URL}/Scripts/FAQView.aspx",
}

# Rotating User-Agent pool (common desktop browsers)
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
    ("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) " "Gecko/20100101 Firefox/125.0"),
]

_REQUEST_TIMEOUT = 30.0  # seconds
_DELAY_MIN = 1.0  # seconds
_DELAY_MAX = 2.0  # seconds

# Map section names to doc_type_enum values from the schema
_SECTION_DOC_TYPE: dict[str, str] = {
    "Notifications": "NOTIFICATION",
    "Master Directions": "MASTER_DIRECTION",
    "Press Releases": "PRESS_RELEASE",
    "FAQs": "OTHER",
}


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------


@dataclass
class RBIDocumentLink:
    """A discovered document link from the RBI website."""

    url: str
    link_text: str
    raw_date_str: str
    doc_type: str
    section: str = ""
    discovered_at: datetime = field(default_factory=datetime.utcnow)

    # Doc type enum values matching the DB schema
    VALID_DOC_TYPES: ClassVar[set[str]] = {
        "CIRCULAR",
        "MASTER_DIRECTION",
        "NOTIFICATION",
        "PRESS_RELEASE",
        "GUIDELINE",
        "OTHER",
    }

    def __post_init__(self) -> None:
        if self.doc_type not in self.VALID_DOC_TYPES:
            self.doc_type = "OTHER"


# ---------------------------------------------------------------------------
# Crawler
# ---------------------------------------------------------------------------


class RBICrawler:
    """Async crawler for RBI regulatory document listings.

    Features:
    - Rotating User-Agent headers
    - 1–2s random delay between requests
    - robots.txt compliance
    - tenacity retry (3 attempts, exponential backoff) on transient errors
    """

    def __init__(self) -> None:
        self._robots_parser: urllib.robotparser.RobotFileParser | None = None
        self._robots_loaded = False

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def fetch_document_links(
        self, section_url: str, *, section_name: str = ""
    ) -> list[RBIDocumentLink]:
        """GET a section listing page, parse anchors, return document links."""
        html = await self._fetch_page(section_url)
        if not html:
            return []

        soup = BeautifulSoup(html, "lxml")
        links: list[RBIDocumentLink] = []
        doc_type = _SECTION_DOC_TYPE.get(section_name, "OTHER")

        for anchor in soup.find_all("a", href=True):
            href: str = anchor["href"]
            link_text = anchor.get_text(strip=True)

            # Skip javascript or anchor-only links
            if href.startswith(("#", "javascript:")):
                continue

            # Resolve relative URLs
            full_url = urljoin(section_url, href)

            # Only keep links pointing to rbi.org.in
            if "rbi.org.in" not in full_url:
                continue

            # For PDF links with empty text (image-only download links on RBI),
            # use the filename as fallback link text. Skip non-PDF links with
            # no text (navigation icons, etc.).
            if not link_text:
                if full_url.lower().endswith(".pdf"):
                    link_text = full_url.rsplit("/", 1)[-1]
                else:
                    continue

            # Try to extract a date string from a sibling or parent cell
            raw_date_str = self._extract_date_from_context(anchor)

            links.append(
                RBIDocumentLink(
                    url=full_url,
                    link_text=link_text,
                    raw_date_str=raw_date_str,
                    doc_type=doc_type,
                    section=section_name,
                )
            )

        logger.info(
            "links_extracted",
            section=section_name,
            url=section_url,
            count=len(links),
        )
        return links

    async def get_new_documents(
        self,
        sections: dict[str, str] | None = None,
        seen_urls: set[str] | None = None,
    ) -> list[RBIDocumentLink]:
        """Crawl all sections and return only previously-unseen document links.

        Args:
            sections: Map of section_name → URL. Defaults to RBI_SECTIONS.
            seen_urls: Set of URLs already processed. New links not in this set
                       are returned.

        Returns:
            List of RBIDocumentLink for documents not in seen_urls.
        """
        if sections is None:
            sections = RBI_SECTIONS
        if seen_urls is None:
            seen_urls = set()

        all_new: list[RBIDocumentLink] = []

        for section_name, section_url in sections.items():
            # Respect robots.txt
            if not await self._is_allowed(section_url):
                logger.warning("robots_blocked", url=section_url)
                continue

            links = await self.fetch_document_links(section_url, section_name=section_name)

            new_links = [link for link in links if link.url not in seen_urls]
            all_new.extend(new_links)

            logger.info(
                "new_documents_found",
                section=section_name,
                total=len(links),
                new=len(new_links),
            )

            # Polite delay between section crawls
            await self._delay()

        logger.info("crawl_complete", total_new=len(all_new))
        return all_new

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    @retry(
        retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.TransportError)),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        stop=stop_after_attempt(3),
        reraise=True,
    )
    async def _fetch_page(self, url: str) -> str | None:
        """Fetch a page with retry, rotating User-Agent, and polite delay."""
        headers = {
            "User-Agent": random.choice(_USER_AGENTS),  # noqa: S311
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }

        async with httpx.AsyncClient(
            timeout=_REQUEST_TIMEOUT,
            follow_redirects=True,
        ) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()

        # Polite delay after each request
        await self._delay()

        return response.text

    async def _is_allowed(self, url: str) -> bool:
        """Check if crawling the URL is allowed by robots.txt."""
        if not self._robots_loaded:
            await self._load_robots_txt()
        if self._robots_parser is None:
            # If robots.txt couldn't be loaded, allow (fail open for crawling)
            return True
        return self._robots_parser.can_fetch("*", url)

    async def _load_robots_txt(self) -> None:
        """Load and parse robots.txt from rbi.org.in."""
        self._robots_loaded = True
        robots_url = f"{_RBI_BASE_URL}/robots.txt"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(robots_url)
                response.raise_for_status()

            parser = urllib.robotparser.RobotFileParser()
            parser.parse(response.text.splitlines())
            self._robots_parser = parser
            logger.info("robots_txt_loaded", url=robots_url)
        except Exception:
            self._robots_parser = None
            logger.warning("robots_txt_failed", url=robots_url, exc_info=True)

    @staticmethod
    def _extract_date_from_context(anchor: object) -> str:
        """Try to extract a date string from a table cell sibling or parent."""
        # RBI listing pages typically have dates in adjacent <td> cells
        from bs4 import Tag

        if not isinstance(anchor, Tag):
            return ""

        # Check sibling <td> elements in the same <tr>
        parent_tr = anchor.find_parent("tr")
        if parent_tr is not None:
            for td in parent_tr.find_all("td"):
                text = td.get_text(strip=True)
                # Common RBI date patterns: "Mar 15, 2024" or "15-03-2024"
                if _looks_like_date(text):
                    return text

        # Check the immediate parent for date text
        parent = anchor.parent
        if parent is not None:
            for sibling in parent.next_siblings:
                if hasattr(sibling, "get_text"):
                    text = sibling.get_text(strip=True)
                    if _looks_like_date(text):
                        return text

        return ""

    @staticmethod
    async def _delay() -> None:
        """Random polite delay between 1–2 seconds."""
        delay = random.uniform(_DELAY_MIN, _DELAY_MAX)  # noqa: S311
        await asyncio.sleep(delay)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_MONTHS = {
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
}


def _looks_like_date(text: str) -> bool:
    """Heuristic check: does this short string look like a date?"""
    if not text or len(text) > 30:
        return False
    lower = text.lower()
    # Contains a month abbreviation and a digit
    has_month = any(m in lower for m in _MONTHS)
    has_digit = any(c.isdigit() for c in text)
    # Or matches dd-mm-yyyy / dd/mm/yyyy pattern (contains - or / with digits)
    has_separator = "-" in text or "/" in text
    return (has_month and has_digit) or (has_separator and has_digit and len(text) <= 12)
