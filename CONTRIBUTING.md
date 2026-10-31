# Contributing

This project is preparing for public distribution; a project license is still pending owner approval. Do not assume permission to redistribute or relicense the project until that is resolved.

Use Node 24/npm 11, `npm ci`, and your own `.env.local` or explicit demo mode. Never use another person's credentials or commit financial exports. New dependencies should have a clear purpose and compatible, reviewed licenses.

For UI work use `HOLDINGS_DEMO_MODE=true` or documented development previews. Create fixtures independently: fictional names, identifiers, balances, holdings and transactions. Do not sanitize real financial records into tests; create synthetic evidence from scratch. Do not attach live screenshots, traces, raw responses, private CSVs, account IDs or logs that might contain tokens.

Keep SDK initialization in `src/server/snaptrade.ts`, using Personal API authentication. Preserve server-only boundaries, the read-method allowlist, same-origin local access, exact decimal calculations, provenance and explicit unavailable states. Never add trading, Commercial registration, remote authentication or cloud persistence as an incidental change. Keep optional Wealthsimple import logic separate from generic SnapTrade readers.

Run lint, typecheck, unit tests, formatting, build and `npm run check:distribution`. CI uses no personal secrets and does not call the brokerage. Add meaningful synthetic regression tests for financial/security changes; UI checks can use Playwright. Review `.gitignore` and the staged diff before committing.

A useful PR explains the concrete problem, resulting behavior, data assumptions, validation and remaining limits. Mention changes to cash-flow conventions, currency, filtering or source precedence explicitly. Report security issues privately following [SECURITY.md](SECURITY.md).
