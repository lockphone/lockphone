import { expect, test } from "@playwright/test";

test("English and Chinese product pages expose the complete public journey", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Lock your");
  await expect(page.getByText("Cumulative sales")).toBeVisible();
  await expect(page.locator(".leader")).toHaveCount(6);
  await page.getByRole("link", { name: "中文" }).click();
  await expect(page).toHaveURL(/\/zh$/);
  await expect(page.locator("main")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("把手机");
  await expect(page.getByText("累计销售额")).toBeVisible();
});

test("public leaderboard never exposes an unmasked demo email", async ({ page }) => {
  await page.goto("/");
  const emails = await page.locator(".identity small").allTextContents();
  expect(emails.length).toBeGreaterThan(0);
  for (const email of emails) expect(email).toMatch(/^[^@]*\*{3}@[^@]+$/);
});

test("legal and support routes are reachable in both languages", async ({ page }) => {
  for (const path of ["/privacy", "/terms", "/support", "/zh/privacy", "/zh/terms", "/zh/support"]) {
    const response = await page.goto(path);
    expect(response?.ok(), path).toBeTruthy();
    await expect(page.locator(".legal-sections section")).toHaveCount(4);
  }
});

test("mobile layout stays within the viewport", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile-only layout assertion");
  await page.goto("/zh");
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport + 1);
  await expect(page.locator(".live-grid")).toHaveCSS("grid-template-columns", /\d+px/);
});
