import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/frontend",
  fullyParallel: true,
  workers: 2,
  use: {
    baseURL: "http://localhost:3000",
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 3000",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
