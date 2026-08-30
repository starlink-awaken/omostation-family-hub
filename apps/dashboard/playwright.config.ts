import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: true,
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node scripts/run-e2e-server.mjs",
    port: 3000,
    reuseExistingServer: false,
    timeout: 120000,
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
