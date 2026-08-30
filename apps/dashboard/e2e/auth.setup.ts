import { test as setup } from "@playwright/test";

setup("authenticate", async ({ page }) => {
  await page.goto("/login");
  await page.fill("#password", "family2026");
  await page.click('button[type="submit"]');
  await page.waitForURL("/");
  await page.context().storageState({ path: "e2e/.auth.json" });
});
