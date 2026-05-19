/**
 * Save / History loop closure — Playwright E2E (slice 4 / S6).
 *
 * Verifies the MVP journey closes:
 *   register → ask → save → /saved shows the item → click → /history/[id]
 *   renders in v2 with the structured answer + citations + confidence meter.
 *
 * Prereqs (same as ask.spec.ts):
 *   - docker compose up running
 *   - DEMO_MODE=true (fixed OTP 123456, work-email gate disabled)
 *   - Real OPENAI + ANTHROPIC keys so the question actually gets a cited
 *     answer (otherwise save is disabled because state.questionId stays null)
 *   - seed_demo.py has been run so the corpus is non-empty
 */

import { test, expect, type Page } from "@playwright/test";

const uniqEmail = () => `saver+${Date.now()}@regpulsetest.in`;

async function registerAndSignIn(page: Page, email: string) {
  await page.goto("/register");
  await page.getByTestId("auth-email").fill(email);
  await page.getByTestId("auth-fullname").fill("Save Tester");
  await page.locator('select[name="org_type"]').selectOption("BANK");
  await page.getByTestId("auth-submit").click();
  await page.waitForURL(/\/verify\?/);
  const first = page.getByTestId("otp-digit-0");
  await first.click();
  await first.evaluate((el, code) => {
    const dt = new DataTransfer();
    dt.setData("text/plain", code);
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true }));
  }, "123456");
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}

async function askKycQuestion(page: Page) {
  await page.goto("/ask");
  await page
    .getByTestId("ask-question-input")
    .fill("What are the KYC periodic-updation timelines for high-risk accounts?");
  await page.getByTestId("ask-submit").click();
  // Wait for the answer to render (~10-30s for real LLM response)
  await expect(
    page.locator('[data-testid="answer-body"], [data-testid="consult-expert"]').first(),
  ).toBeVisible({ timeout: 60_000 });
}

test.describe("save → history loop", () => {
  test.beforeEach(async ({ page }) => {
    await registerAndSignIn(page, uniqEmail());
  });

  test("ask → save → /saved → reopen via /history/[id]", async ({ page }) => {
    await askKycQuestion(page);

    // The Save button is disabled until state.questionId is set (i.e. after
    // the answer stream finishes and the server returns the persisted ID).
    const save = page.getByTestId("ask-save");
    await expect(save).toBeEnabled({ timeout: 60_000 });
    await save.click();
    await expect(save).toContainText(/saved/i);

    // /saved must show at least one card
    await page.goto("/saved");
    const cards = page.getByTestId("saved-card");
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });

    // Click the first live saved card → navigates to /history/{id}
    await cards.first().click();
    await page.waitForURL(/\/history\/[0-9a-f-]+/);

    // History detail renders in v2: serif question headline + answer body
    await expect(page.getByTestId("history-detail")).toBeVisible();
    await expect(page.getByTestId("history-question-text")).toBeVisible();
    await expect(
      page
        .locator('[data-testid="history-answer-body"], [data-testid="history-confidence"]')
        .first(),
    ).toBeVisible();

    // v2 token sanity: warm-paper background
    const bg = await page.evaluate(() =>
      getComputedStyle(document.body).getPropertyValue("background-color"),
    );
    expect(bg).toMatch(/rgb\(246,\s*245,\s*241\)/);
  });

  test("history page shows feedback yes/no controls", async ({ page }) => {
    await askKycQuestion(page);
    await expect(page.getByTestId("ask-save")).toBeEnabled({ timeout: 60_000 });
    await page.getByTestId("ask-save").click();

    await page.goto("/saved");
    await expect(page.getByTestId("saved-card").first()).toBeVisible();
    await page.getByTestId("saved-card").first().click();

    await expect(page.getByTestId("history-feedback-yes")).toBeVisible();
    await expect(page.getByTestId("history-feedback-no")).toBeVisible();
    await expect(page.getByTestId("history-share-button")).toBeVisible();
  });
});
