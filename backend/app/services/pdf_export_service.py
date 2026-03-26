"""PDF export service — generate compliance brief PDFs from Q&A answers.

Uses simple HTML-to-text approach for portability (no wkhtmltopdf dependency).
Generates a structured text document that can be saved as PDF by the client.
"""

from __future__ import annotations

from datetime import UTC, datetime

import structlog

logger = structlog.get_logger("regpulse.pdf_export")


class PDFExportService:
    """Generate compliance brief exports from Q&A data."""

    @staticmethod
    def generate_brief(
        *,
        question_text: str,
        answer_text: str | None,
        quick_answer: str | None,
        risk_level: str | None,
        affected_teams: list[str] | None,
        citations: list[dict] | None,
        recommended_actions: list[dict] | None,
        created_at: str | None,
    ) -> str:
        """Generate a structured compliance brief as formatted text.

        Returns a string that can be rendered as a downloadable document.
        """
        now = datetime.now(UTC).strftime("%d %B %Y, %H:%M UTC")
        lines = [
            "=" * 72,
            "REGPULSE COMPLIANCE BRIEF",
            "=" * 72,
            f"Generated: {now}",
            "",
            "-" * 72,
            "QUESTION",
            "-" * 72,
            question_text,
            "",
        ]

        if quick_answer:
            lines += [
                "-" * 72,
                "EXECUTIVE SUMMARY",
                "-" * 72,
                quick_answer,
                "",
            ]

        if risk_level:
            lines.append(f"Risk Level: {risk_level}")
            lines.append("")

        if affected_teams:
            lines.append(f"Affected Teams: {', '.join(affected_teams)}")
            lines.append("")

        if answer_text:
            lines += [
                "-" * 72,
                "DETAILED INTERPRETATION",
                "-" * 72,
                answer_text,
                "",
            ]

        if citations:
            lines += ["-" * 72, "CITATIONS", "-" * 72]
            for i, c in enumerate(citations, 1):
                cn = c.get("circular_number", "Unknown")
                quote = c.get("verbatim_quote", "")
                ref = c.get("section_reference", "")
                lines.append(f"  [{i}] {cn}")
                if ref:
                    lines.append(f"      Section: {ref}")
                if quote:
                    lines.append(f'      "{quote}"')
                lines.append("")

        if recommended_actions:
            lines += ["-" * 72, "RECOMMENDED ACTIONS", "-" * 72]
            for i, a in enumerate(recommended_actions, 1):
                team = a.get("team", "")
                action = a.get("action_text", "")
                priority = a.get("priority", "")
                lines.append(f"  {i}. [{priority}] {team}: {action}")
            lines.append("")

        lines += [
            "=" * 72,
            "DISCLAIMER",
            "RegPulse is not a legal advisory service. This brief is",
            "AI-generated from indexed RBI circulars and should be verified",
            "against official sources at rbi.org.in before making compliance",
            "decisions.",
            "=" * 72,
        ]

        return "\n".join(lines)
