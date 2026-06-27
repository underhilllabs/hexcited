// @ts-check
const { defineConfig, devices } = require("@playwright/test");

/**
 * Serves the static game over a local HTTP server and runs the browser tests
 * against it. Using a real server (rather than file://) keeps script loading
 * and the Web Audio API behaving the way they do for a real player.
 */
module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:8123",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "python3 -m http.server 8123",
    url: "http://127.0.0.1:8123/index.html",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
