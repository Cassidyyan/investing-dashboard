import { test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";
import { baseURL, statePath, storageState } from "./settings.mjs";

test("Save a manually authenticated browser session", async ({ browser }) => {
  const context = await browser.newContext({ storageState: storageState() });
  const page = await context.newPage();
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  console.log(
    "Sign in manually in Chromium. When finished, click Resume in the Playwright Inspector to save the session. No credentials are requested by this tool.",
  );
  await page.pause();
  await mkdir(path.dirname(statePath), { recursive: true, mode: 0o700 });
  await writeFile(
    statePath,
    await format(JSON.stringify(await context.storageState()), {
      parser: "json",
    }),
    { mode: 0o600 },
  );
  console.log(
    "Saved browser state to the configured private storage-state file.",
  );
  await context.close();
});
