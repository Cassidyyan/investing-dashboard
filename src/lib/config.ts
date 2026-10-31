// Pure validation shared by the server and the local `npm run check:config` tool.
// Never return this whole object to a client: only PublicSettings is safe to send.
export type OptionsCurrencyPolicy = "reported" | "USD";
export type PublicSettings = {
  demo: boolean;
  optionsCurrency: OptionsCurrencyPolicy;
  cashOnlyAsHysa: boolean;
};
type Environment = Record<string, string | undefined>;
export function parseConfig(env: Environment) {
  const errors: string[] = [];
  const flag = (name: string) => {
    const value = env[name]?.trim() || "false";
    if (value !== "true" && value !== "false")
      errors.push(`${name} must be true or false.`);
    return value === "true";
  };
  const demo = flag("HOLDINGS_DEMO_MODE");
  const cashOnlyAsHysa = flag("HOLDINGS_CASH_ONLY_AS_HYSA");
  const currency = env.HOLDINGS_OPTIONS_CURRENCY?.trim() || "reported";
  if (currency !== "reported" && currency !== "USD")
    errors.push("HOLDINGS_OPTIONS_CURRENCY must be reported or USD.");
  const clientId = env.SNAPTRADE_CLIENT_ID?.trim() || "";
  const consumerKey = env.SNAPTRADE_CONSUMER_KEY?.trim() || "";
  const invalid = (value: string) =>
    /\s|["'<>]/.test(value) ||
    /^(?:your_|replace_|example_|CLIENT_ID$|CONSUMER_KEY$)/i.test(value);
  const credentialsValid =
    !!clientId && !!consumerKey && !invalid(clientId) && !invalid(consumerKey);
  if (!demo) {
    if (!clientId) errors.push("Set SNAPTRADE_CLIENT_ID in .env.local.");
    else if (invalid(clientId))
      errors.push(
        "SNAPTRADE_CLIENT_ID must be your own Personal client ID, without placeholders or whitespace.",
      );
    if (!consumerKey) errors.push("Set SNAPTRADE_CONSUMER_KEY in .env.local.");
    else if (invalid(consumerKey))
      errors.push(
        "SNAPTRADE_CONSUMER_KEY must be your own Personal consumer key, without placeholders or whitespace.",
      );
  }
  const logoKey = env.LOGO_DEV_PUBLISHABLE_KEY?.trim() || "";
  if (logoKey && !/^pk_[A-Za-z0-9_-]+$/.test(logoKey))
    errors.push(
      "LOGO_DEV_PUBLISHABLE_KEY must be a publishable pk_ key; leave it empty to disable logos.",
    );
  for (const name of Object.keys(env))
    if (/^NEXT_PUBLIC_SNAPTRADE/i.test(name) && env[name])
      errors.push(
        "Remove public SnapTrade environment variables: credentials must stay server-side.",
      );
  const settings: PublicSettings = {
    demo,
    optionsCurrency: currency === "USD" ? "USD" : "reported",
    cashOnlyAsHysa,
  };
  return {
    settings,
    credentials: credentialsValid ? { clientId, consumerKey } : null,
    errors,
  };
}
