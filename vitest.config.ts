import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL(".", import.meta.url));
export default defineConfig({
  resolve: {
    alias: {
      "server-only": resolve(root, "tests/helpers/server-only.ts"),
      "@": resolve(root, "src"),
    },
  },
  test: {
    environment: "node",
    env: {
      // Tests never inherit live credentials or a developer's presentation policy.
      SNAPTRADE_CLIENT_ID: "",
      SNAPTRADE_CONSUMER_KEY: "",
      LOGO_DEV_PUBLISHABLE_KEY: "",
      HOLDINGS_DEMO_MODE: "false",
      HOLDINGS_OPTIONS_CURRENCY: "USD",
      HOLDINGS_CASH_ONLY_AS_HYSA: "false",
    },
  },
});
