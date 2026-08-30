import { test, expect } from "@playwright/test";

const ERROR_TEXT = [/error/i, /未登录/];

async function assertNoError(page: import("@playwright/test").Page) {
  const body = page.locator("body");
  for (const pattern of ERROR_TEXT) {
    await expect(body).not.toContainText(pattern);
  }
}

test.describe("Login", () => {
  test("renders login page correctly", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("h1")).toContainText("登录");
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("wrong password shows error message", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#password", "wrong_password_123");
    await page.click('button[type="submit"]');
    await expect(page.locator("body")).toContainText("口令不正确");
  });
});

test.describe("Authenticated pages", () => {
  test("Documents writes remain disabled", async ({ request }) => {
    const save = await request.post("/api/file/save", {
      data: { path: "_knowledge/test.md", content: "synthetic" },
    });
    const backup = await request.get("/api/cron/ssot-backup");

    expect(save.status()).toBe(403);
    expect(backup.status()).toBe(403);
    expect(await save.json()).toMatchObject({ code: "DOCUMENTS_WRITE_DISABLED" });
    expect(await backup.json()).toMatchObject({ code: "DOCUMENTS_WRITE_DISABLED" });
  });

  test("/ (home) loads", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "每日简报" })).toBeVisible();
    await assertNoError(page);
  });

  test("/members loads", async ({ page }) => {
    await page.goto("/members");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).not.toBeEmpty();
    await assertNoError(page);
  });

  test("/assets loads", async ({ page }) => {
    await page.goto("/assets");
    await expect(page.locator("body")).not.toBeEmpty();
    await assertNoError(page);
  });

  test("/growth loads", async ({ page }) => {
    await page.goto("/growth");
    await expect(page.locator("body")).not.toBeEmpty();
    await assertNoError(page);
  });

  test("/daily loads", async ({ page }) => {
    await page.goto("/daily");
    await expect(page.locator("body")).not.toBeEmpty();
    await assertNoError(page);
  });

  test("/health loads", async ({ page }) => {
    await page.goto("/health");
    await expect(page.locator("h1")).toBeVisible();
    await assertNoError(page);
  });

  test("/tasks loads", async ({ page }) => {
    await page.goto("/tasks");
    await expect(page.locator("h1")).toContainText("任务看板");
    await assertNoError(page);
  });

  test("/knowledge loads", async ({ page }) => {
    await page.goto("/knowledge");
    await expect(page.locator("h1")).toContainText("知识面板");
    await assertNoError(page);
  });

  test("/files loads", async ({ page }) => {
    await page.goto("/files");
    await expect(page.locator("h1")).toContainText("文件浏览");
    await assertNoError(page);
  });

  test("/timeline loads", async ({ page }) => {
    await page.goto("/timeline");
    await expect(page.locator("h1")).toContainText("家庭时间线");
    await assertNoError(page);
  });

  test("/finance loads", async ({ page }) => {
    await page.goto("/finance");
    await expect(page.locator("h1")).toContainText("账目看板");
    await assertNoError(page);
  });

  test("/edit loads", async ({ page }) => {
    await page.goto("/edit");
    await expect(page.locator("body")).not.toBeEmpty();
    await assertNoError(page);
  });

  test("/calendar loads", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page.locator("h1")).toContainText("日历与纪念日");
    await assertNoError(page);
  });

  test("/tags loads", async ({ page }) => {
    await page.goto("/tags");
    await expect(page.locator("h1")).toContainText("标签");
    await assertNoError(page);
  });

  test("/graph loads", async ({ page }) => {
    await page.goto("/graph");
    await expect(page.locator("h1")).toContainText("知识图谱");
    await assertNoError(page);
  });

  test("/ask loads", async ({ page }) => {
    await page.goto("/ask");
    await expect(page.locator("h1")).toBeVisible();
    await assertNoError(page);
  });
});
