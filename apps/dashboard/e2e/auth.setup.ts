import { test as setup } from "@playwright/test";

setup("authenticate", async ({ page }) => {
  await page.goto("/login");
  await page.fill("#password", "synthetic-e2e-password");
  await page.click('button[type="submit"]');
  await page.waitForURL("/");
  await page.context().storageState({ path: "e2e/.auth.json" });
});
