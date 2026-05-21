/**
 * Canonical plain-text extraction from markdown answer content.
 * Used for annotation offset calculation and inline highlight rendering
 * so selections survive page reloads.
 */
export function markdownToPlainText(markdown: string): string {
  let text = markdown;

  // Fenced code blocks → inner content only
  text = text.replace(/```[\s\S]*?```/g, (block) =>
    block.replace(/^```[^\n]*\n?/, "").replace(/```$/, ""),
  );

  // Inline code
  text = text.replace(/`([^`]+)`/g, "$1");

  // Links: [label](url) → label
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // Images: ![alt](url) → alt
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");

  // Headings, blockquotes, list markers
  text = text.replace(/^#{1,6}\s+/gm, "");
  text = text.replace(/^>\s?/gm, "");
  text = text.replace(/^[\t ]*[-*+]\s+/gm, "");
  text = text.replace(/^[\t ]*\d+\.\s+/gm, "");

  // Bold / italic markers
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/__([^_]+)__/g, "$1");
  text = text.replace(/\*([^*]+)\*/g, "$1");
  text = text.replace(/_([^_]+)_/g, "$1");

  // Horizontal rules
  text = text.replace(/^[-*_]{3,}\s*$/gm, "");

  return text;
}

/**
 * Map a DOM text selection (from rendered plain text) to canonical plain-text offsets.
 */
export function selectionToPlainTextOffsets(
  container: HTMLElement,
  range: Range,
  plainText: string,
): { start: number; end: number; text: string } | null {
  const selected = range.toString();
  if (!selected.trim()) return null;

  const preRange = document.createRange();
  preRange.selectNodeContents(container);
  preRange.setEnd(range.startContainer, range.startOffset);
  const domStart = preRange.toString().length;
  const domEnd = domStart + selected.length;

  // DOM text should match plainText when rendered in the same container;
  // normalize minor whitespace differences for robustness.
  const domFull = container.textContent ?? "";
  if (domFull === plainText) {
    return { start: domStart, end: domEnd, text: selected.trim() };
  }

  // Fallback: locate selected snippet in canonical plain text
  const needle = selected.trim();
  const idx = plainText.indexOf(needle, Math.max(0, domStart - 50));
  if (idx === -1) return null;
  return { start: idx, end: idx + needle.length, text: needle };
}
