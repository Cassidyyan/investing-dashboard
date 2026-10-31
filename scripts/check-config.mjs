import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
import { parseConfig } from "../src/lib/config.ts";
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production", {
  info() {},
  error() {},
});
const { settings, credentials, errors } = parseConfig(process.env);
if (errors.length) {
  for (const message of errors) console.error(message);
  process.exitCode = 1;
} else {
  console.log(
    settings.demo
      ? "Configuration valid: demo mode; no brokerage access."
      : credentials
        ? "Configuration valid: own Personal credentials configured (not printed or sent)."
        : "Credentials are not configured.",
  );
  console.log(
    `Options currency: ${settings.optionsCurrency}. Cash-only investing uses ${settings.cashOnlyAsHysa ? "the personal HYSA label" : "the generic label"}.`,
  );
}
