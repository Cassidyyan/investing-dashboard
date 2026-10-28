import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { format } from "prettier";
import { artifactDirectory, root } from "./settings.mjs";
const require = createRequire(import.meta.url);
const args = process.argv.slice(2),
  login = args.includes("--login");
const extra = args.filter(
  (a) => !["--login", "--mask", "--no-mask", "--"].includes(a),
);
const child = spawn(
  process.execPath,
  [
    require.resolve("@playwright/test/cli"),
    "test",
    "--config",
    "screenshots-tool/playwright.config.mjs",
    "--project",
    login ? "login" : "capture",
    ...extra,
  ],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      SCREENSHOTS_MASK: args.includes("--no-mask")
        ? "0"
        : args.includes("--mask")
          ? "1"
          : process.env.SCREENSHOTS_MASK || "1",
      SCREENSHOTS_RUN_ID: new Date().toISOString().replace(/[:.]/g, "-"),
    },
  },
);
child.on("error", () => {
  console.error(
    "Could not start Playwright. Run npm ci and npx playwright install chromium.",
  );
  process.exitCode = 1;
});
child.on("exit", async (code) => {
  // Keep generated runner metadata compatible with the project's formatter.
  const lastRun = path.join(artifactDirectory, ".last-run.json");
  if (existsSync(lastRun))
    writeFileSync(
      lastRun,
      await format(readFileSync(lastRun, "utf8"), { parser: "json" }),
    );
  process.exitCode = code ?? 1;
});
