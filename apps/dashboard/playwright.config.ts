import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "bun run dev",
    port: 3000,
    reuseExistingServer: true,
    timeout: 30000,
    env: {
      FAMILY_DASHBOARD_PASSWORD: "family2026",
    },
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "e2e",
      testMatch: /pages\.spec\.ts/,
      dependencies: ["setup"],
      use: { storageState: "e2e/.auth.json" },
    },
  ],
});
