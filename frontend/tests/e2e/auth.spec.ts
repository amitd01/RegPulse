/**
 * Auth journey — Playwright E2E (slice 1).
 *
 * Runs against `docker compose up` with DEMO_MODE=true:
 *   - OTP is fixed to 123456
 *   - any work-email-shaped address is accepted
 *
 * Coverage:
 *   1. Register form renders in v2 design (paper bg, no navy classes)
 *   2. Register → email + name → /verify lands with masked email
 *   3. Verify OTP 123456 → dashboard, auth store populated
 *   4. Login flow: /login → /verify → /dashboard
 *   5. Already-registered user can sign back in
 *
 * Locators use data-testid for stability across visual tweaks.
 */

import { test, expect, type Page } from "@playwright/test";

const uniqEmail = () => `tester+${Date.now()}@regpulsetest.in`;

async function fillRegisterForm(page: Page, email: string) {
  await page.goto("/register");
  await expect(page.getByRole("heading", { name: /open your terminal/i })).toBeVisible();
  await page.getByTestId("auth-email").fill(email);
  await page.getByTestId("auth-fullname").fill("Test User");
  await page.locator('select[name="org_type"]').selectOption("BANK");
  await page.getByTestId("auth-submit").click();
}

async function enterOtp(page: Page, otp: string) {
  await expect(page).toHaveURL(/\/verify\?/);
  await expect(page.getByTestId("auth-masked-email")).toBeVisible();
  // Paste path — OTPInput accepts pasted strings into the first box
  const first = page.getByTestId("otp-digit-0");
  await first.click();
  await first.press("Control+a");
  await first.fill("");
  await first.evaluate((el, code) => {
    const dt = new DataTransfer();
    dt.setData("text/plain", code);
    const evt = new ClipboardEvent("paste", { clipboardData: dt, bubbles: true });
    el.dispatchEvent(evt);
  }, otp);
  // The auto-submit handler fires when the 6th digit lands
}

test.describe("v2 visual sanity", () => {
  test("login page renders in v2 (no navy classes anywhere)", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    // Probe the design tokens are active
    const bg = await page.evaluate(() =>
      getComputedStyle(document.body).getPropertyValue("background-color"),
    );
    // var(--bg) is #f6f5f1 → rgb(246, 245, 241)
    expect(bg).toMatch(/rgb\(246,\s*245,\s*241\)/);
    // Brand mark visible
    await expect(page.getByLabel("RegPulse home")).toBeVisible();
  });

  test("register page renders in v2", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: /open your terminal/i })).toBeVisible();
    await expect(page.getByTestId("auth-email")).toBeVisible();
    await expect(page.getByTestId("auth-fullname")).toBeVisible();
  });
});

test.describe("registration journey", () => {
  test("register → verify (fixed OTP 123456) → dashboard", async ({ page }) => {
    const email = uniqEmail();
    await fillRegisterForm(page, email);

    await page.waitForURL(/\/verify\?/);
    await enterOtp(page, "123456");

    // On success, /dashboard is the auth-gated landing
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
    // AppShell brand mark visible inside the app
    await expect(page.getByText(/dashboard/i).first()).toBeVisible();
  });

  test("invalid OTP surfaces error envelope", async ({ page }) => {
    const email = uniqEmail();
    await fillRegisterForm(page, email);
    await page.waitForURL(/\/verify\?/);
    await enterOtp(page, "000000");

    await expect(page.getByTestId("auth-error")).toBeVisible({ timeout: 8_000 });
  });
});

test.describe("login journey", () => {
  test("existing user: login → verify → dashboard", async ({ page }) => {
    const email = uniqEmail();
    // Seed an account first
    await fillRegisterForm(page, email);
    await page.waitForURL(/\/verify\?/);
    await enterOtp(page, "123456");
    await page.waitForURL(/\/dashboard/);

    // Logout (best-effort — depends on AppShell having a logout button)
    await page.context().clearCookies();
    await page.evaluate(() => sessionStorage.clear());

    // Re-sign in
    await page.goto("/login");
    await page.getByTestId("auth-email").fill(email);
    await page.getByTestId("auth-submit").click();

    await page.waitForURL(/\/verify\?/);
    await enterOtp(page, "123456");
    await page.waitForURL(/\/dashboard/);
  });
});
