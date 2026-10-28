import { defineConfig } from "@playwright/test";
import {
  artifactDirectory,
  appURL,
  baseURL,
  hostname,
  localServer,
  port,
  root,
} from "./settings.mjs";

export default defineConfig({
  testDir: ".",
  timeout: 0,
  expect: { timeout: 5000 },
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  outputDir: artifactDirectory,
  use: {
    browserName: "chromium",
    baseURL,
    actionTimeout: 6000,
    navigationTimeout: 90000,
    trace: "off",
    screenshot: "off",
    video: "off",
    serviceWorkers: "block",
  },
  webServer: localServer
    ? {
        command: `npm run dev -- --hostname ${hostname} --port ${port}`,
        url: appURL("/", "sample"),
        reuseExistingServer: true,
        timeout: 120000,
        stdout: "ignore",
        stderr: "ignore",
        cwd: root,
      }
    : undefined,
  projects: [
    { name: "capture", testMatch: "capture.pw.mjs", use: { headless: true } },
    { name: "login", testMatch: "login.pw.mjs", use: { headless: false } },
  ],
});
