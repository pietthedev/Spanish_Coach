import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  // Lessons and Drive Mode narrate through speechSynthesis, which is a single
  // global resource per browser. Too many parallel contexts interrupt each
  // other's utterances and time out on audio-gated steps.
  workers: 2,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: { baseURL: "http://127.0.0.1:3000", trace: "on-first-retry" },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "Galaxy-S23",
      use: { ...devices["Galaxy S9+"], viewport: { width: 360, height: 780 } },
    },
    {
      name: "Galaxy-S25",
      use: { ...devices["Galaxy S9+"], viewport: { width: 412, height: 915 } },
    },
  ],
});
