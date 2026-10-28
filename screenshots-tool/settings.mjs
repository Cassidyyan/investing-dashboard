import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../", import.meta.url));
const suppliedURL = new URL(
  process.env.SCREENSHOTS_BASE_URL || "http://127.0.0.1:3000",
);
if (
  !["http:", "https:"].includes(suppliedURL.protocol) ||
  suppliedURL.username ||
  suppliedURL.password ||
  suppliedURL.search ||
  suppliedURL.hash
)
  throw new Error(
    "SCREENSHOTS_BASE_URL must be an HTTP(S) URL without credentials, query parameters or a fragment.",
  );
export const baseURL = suppliedURL.href.replace(/\/$/, "") + "/";
export const localServer = ["localhost", "127.0.0.1", "[::1]"].includes(
  suppliedURL.hostname,
);
export const port =
  suppliedURL.port || (suppliedURL.protocol === "https:" ? "443" : "80");
export const hostname = suppliedURL.hostname.replace(/[\[\]]/g, "");
export const statePath = path.resolve(
  root,
  process.env.SCREENSHOTS_STORAGE_STATE ||
    "screenshots-tool/.auth/storage-state.json",
);
export const storageState = () =>
  existsSync(statePath) ? statePath : undefined;
export const masked = process.env.SCREENSHOTS_MASK !== "0";
export const dataMode = process.env.SCREENSHOTS_DATA_MODE || "auto";
if (!["auto", "preview", "live"].includes(dataMode))
  throw new Error("SCREENSHOTS_DATA_MODE must be auto, preview or live.");
const runID =
  process.env.SCREENSHOTS_RUN_ID ||
  new Date().toISOString().replace(/[:.]/g, "-");
if (!/^[\w-]+$/.test(runID))
  throw new Error("Invalid screenshot run identifier.");
export const runDirectory = path.join(root, "screenshots", runID);
export const artifactDirectory = path.join(
  root,
  "screenshots-tool",
  ".artifacts",
);
export const maxExpansions = Math.max(
  1,
  Math.min(200, Number(process.env.SCREENSHOTS_MAX_EXPANSIONS || 60)),
);
export const viewports = [
  {
    name: "desktop",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
  {
    name: "tablet",
    viewport: { width: 820, height: 1180 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
  {
    name: "mobile",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
];
export function appURL(route, preview) {
  const url = new URL(route.replace(/^\//, ""), baseURL);
  if (preview) url.searchParams.set("preview", preview);
  return url.href;
}
// Next.js App Router's filesystem IS the router configuration. Not a hand-written route list.
export function discoverRoutes() {
  const directory = ["src/app", "app"]
    .map((p) => path.join(root, p))
    .find(existsSync);
  if (!directory) throw new Error("Next.js App Router directory not found.");
  const discovered = [];
  function walk(folder, segments = []) {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      if (entry.isDirectory() && !entry.name.startsWith("_"))
        walk(path.join(folder, entry.name), [...segments, entry.name]);
      if (!entry.isFile() || !/^page\.(tsx?|jsx?|mdx)$/.test(entry.name))
        continue;
      const intercepted = segments.some((s) => /^\(\.{1,3}\)/.test(s));
      const parts = segments.filter(
        (s) => !s.startsWith("(") && !s.startsWith("@"),
      );
      const route = "/" + parts.join("/");
      const source = readFileSync(path.join(folder, entry.name), "utf8");
      discovered.push({
        route,
        slug: parts.length
          ? parts.join("-").replace(/[^a-zA-Z0-9_-]/g, "-")
          : "overview",
        source: path.relative(root, path.join(folder, entry.name)),
        preview:
          /NODE_ENV\s*===\s*["']development["']/.test(source) &&
          /preview/.test(source),
        unsupported: intercepted
          ? "Intercepting route needs a navigation context."
          : /\[/.test(route)
            ? "Dynamic route requires concrete parameters, which were not provided."
            : null,
      });
    }
  }
  walk(directory);
  return [...new Map(discovered.map((r) => [r.route, r])).values()].sort(
    (a, b) => a.route.localeCompare(b.route),
  );
}
