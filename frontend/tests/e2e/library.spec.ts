/**
 * Library E2E — slice 2b / S4b.2.
 *
 * Verifies the library list + detail journey against a real RBI corpus
 * (≥20 circulars, ingested by `scraper.run_oneshot priority` per S4b.2).
 *
 * Prereqs:
 *   - `docker compose up postgres redis backend scraper` (the scraper service
 *     must have completed at least one priority run).
 *   - Local docker compose stack running on :3000 (frontend) and :8000 (api).
 *   - Library is browsable without auth (rule "Library browsable without auth")
 *     so this spec does NOT register a user.
 */

import { test, expect } from "@playwright/test";

test.describe("library journey", () => {
  test("v2 token sanity: list page renders on warm-paper background", async ({ page }) => {
    await page.goto("/library");
    await page.getByTestId("library-card").first().waitFor({ state: "visible", timeout: 15_000 });
    const bg = await page.evaluate(() =>
      getComputedStyle(document.body).getPropertyValue("background-color"),
    );
    expect(bg).toMatch(/rgb\(246,\s*245,\s*241\)/);
  });

  test("library list shows ≥20 ingested circulars from the live API", async ({ page }) => {
    // Hit the API directly first to confirm the corpus is non-empty. This makes
    // the failure mode clear if the scrape hasn't run — Playwright otherwise
    // ends up timing out on the list waiter without telling us the DB is empty.
    const resp = await page.request.get(
      "http://localhost:8000/api/v1/circulars?page=1&page_size=20",
    );
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.total).toBeGreaterThanOrEqual(20);

    await page.goto("/library");
    const cards = page.getByTestId("library-card");
    // The page renders one card per circular returned by the API. With page_size=20
    // and total≥20 we expect a full grid. Poll the count rather than checking
    // once — the initial render shows mock fallback (26 cards from RP_DATA) for
    // a tick before TanStack Query swaps in live data; both states have visible
    // cards, so .toBeVisible() can resolve on the wrong frame.
    await expect.poll(async () => cards.count(), { timeout: 15_000 }).toBe(20);
  });

  test("clicking a card opens /library/[id] with structured-content rendered", async ({ page }) => {
    await page.goto("/library");
    const cards = page.getByTestId("library-card");
    // Wait for live data to swap in. Mocks render with link="#" so clicking
    // them is a no-op; live cards wrap the panel in a <Link href=/library/{id}>.
    await expect.poll(async () => cards.count(), { timeout: 15_000 }).toBe(20);

    await cards.first().click();
    await page.waitForURL(/\/library\/[0-9a-f-]+/);

    // Either the structural renderer fires (preferred — proves the dual-output
    // chunker is wired end-to-end) or the explicit "not available" fallback
    // shows. Rule 16: never render `document_chunks.chunk_text` directly to
    // users, so a missing structured tree must surface the fallback testid,
    // never a chunk-card dump.
    await expect(
      page
        .locator(
          '[data-testid="structured-content"], [data-testid="structured-content-unavailable"]',
        )
        .first(),
    ).toBeVisible({ timeout: 10_000 });

    // The source link always points at the real rbi.org.in URL (rule 5: no
    // PDF hosting on our infra).
    const sourceHref = await page.getByTestId("rbi-source-link").getAttribute("href");
    expect(sourceHref).toMatch(/rbi\.org\.in/);
  });

  test("structured content includes ≥1 heading or paragraph block when available", async ({
    page,
  }) => {
    // Probe the API for a circular known to have structured_content, then visit
    // its detail page and assert the renderer emitted real prose.
    const listResp = await page.request.get(
      "http://localhost:8000/api/v1/circulars?page=1&page_size=20",
    );
    const list = (await listResp.json()).data as Array<{ id: string }>;
    expect(list.length).toBeGreaterThan(0);

    let withStructure: string | null = null;
    for (const c of list) {
      const detailResp = await page.request.get(
        `http://localhost:8000/api/v1/circulars/${c.id}`,
      );
      const detail = await detailResp.json();
      if (detail.data?.structured_content?.blocks?.length > 0) {
        withStructure = c.id;
        break;
      }
    }
    // If the scrape ran and dual-output chunking worked, at least one of the
    // first 20 circulars must have a structured tree. If not, the persistence
    // wiring (scraper/tasks.py INSERT) regressed.
    expect(withStructure).not.toBeNull();

    await page.goto(`/library/${withStructure}`);
    const renderer = page.getByTestId("structured-content");
    await expect(renderer).toBeVisible();
    // The renderer emits headings as <h2/h3/h4> and paragraphs as <p>; at least
    // one of those should exist inside the structured-content container.
    const blockCount = await renderer.locator("h2, h3, h4, p").count();
    expect(blockCount).toBeGreaterThan(0);
  });
});
