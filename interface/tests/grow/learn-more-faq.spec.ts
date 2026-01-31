import { test, expect, type Page } from "@playwright/test";

test.describe("Learn more FAQ", () => {
  const base = "http://127.0.0.1:5173";

  const setLocale = async (page: Page, localeName: "English" | "简体中文") => {
    await page.goto(`${base}/home/user/i18n`);
    const btn = page.getByRole("button", { name: localeName });
    await btn.click();
    await expect(btn.locator("svg")).toBeVisible();
  };

  test("renders FAQ in EN and ZH", async ({ page }) => {
    test.setTimeout(30_000);

    await setLocale(page, "English");
    await page.goto(`${base}/market-making`);
    await expect(
      page.getByTestId("bottom-nav-home").locator(".dock-label")
    ).toHaveText("Home", { timeout: 15_000 });

    await page.goto(`${base}/market-making/hufi/learn-more`);
    await expect(page.getByTestId("hufi-learn-more").locator(".collapse")).toHaveCount(7);
    await expect(page.getByText("What is Hu-Fi?")).toBeVisible();
    await page.getByText("What is Hu-Fi?").click();
    await expect(
      page.getByText(
        "Hu-Fi is an incentive system that rewards users for verifiable actions (for example, market making on a target exchange and trading pair, or holding an asset), depending on the campaign rules."
      )
    ).toBeVisible();

    await page.goto(`${base}/market-making/learn-more`);
    await expect(page.getByTestId("market-making-learn-more").locator(".collapse")).toHaveCount(7);
    await expect(page.getByText("What is market making?")).toBeVisible();
    await page.getByText("What is market making?").click();
    await expect(
      page.getByText(
        "Market making is the practice of continuously providing buy and sell quotes to improve liquidity and reduce spreads."
      )
    ).toBeVisible();

    await setLocale(page, "简体中文");
    await page.goto(`${base}/market-making`);
    await expect(
      page.getByTestId("bottom-nav-home").locator(".dock-label")
    ).toHaveText("首页", { timeout: 15_000 });

    await page.goto(`${base}/market-making/hufi/learn-more`);
    await expect(page.getByText("什么是 Hu-Fi？")).toBeVisible({ timeout: 15_000 });

    await page.goto(`${base}/market-making/learn-more`);
    await expect(page.getByText("什么是做市？")).toBeVisible({ timeout: 15_000 });
  });
});
