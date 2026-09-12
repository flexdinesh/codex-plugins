import { defineConfig } from "@playwright/test";

const port = 14317;

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: "chromium",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node src/server.ts --test-data",
    env: { PORT: String(port) },
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
  },
});
