import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.js",
  workers: 1,
  use: { browserName: "chromium", headless: true, screenshot: "only-on-failure" },
  reporter: "list"
});
