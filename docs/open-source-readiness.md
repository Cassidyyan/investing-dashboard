# Phase 3 — local distribution readiness

Assessment date: October 31, 2026. Scope: independent, locally operated copies using each operator's SnapTrade Personal key. Advanced options analytics, cloud databases, trading, remote logins, GitHub publication and repository-visibility changes are outside this phase.

**Status: Not ready to publish yet.** The working tree has substantial distribution safeguards, but owner approval of a project license, review of personal aggregate metadata in older Git commits, a working private security-reporting channel, and SnapTrade's distribution-policy confirmation remain outstanding. No history rewrite, credential rotation, push or publication was performed.

## Initial audit and resulting classification

| Question                                         | Initial gap / evidence                                                                                                               | Current classification                                                                                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Can a stranger install it?                       | Runtime versions, first-run instructions and CI were incomplete. Private files were optional.                                        | Ready for distribution at the code level after the tested setup process; publication gates below still apply.                                                      |
| Does it use the maintainer's credentials or IDs? | SDK read only local environment values. No hardcoded credential or known local account-ID match was found in source/history/bundles. | Ready for distribution for the scoped authentication implementation; unknown secrets still require manual review.                                                  |
| Can another Personal user use their own key?     | Installed SDK already used Personal auth, omitting userId/userSecret.                                                                | Ready for distribution: validation, first-run guide and synthetic authentication contract tests added. No live test with another person's key was performed.       |
| Are Wealthsimple assumptions universal?          | HYSA and USD relabelling were personal defaults; CSV parser is brokerage-specific.                                                   | Requires configuration choices: generic cash label and reported currencies now default; owner preferences stay local. Wealthsimple-only import format is explicit. |
| Are env values documented?                       | Only three empty key names existed.                                                                                                  | Ready for distribution: all supported settings documented and locally validated, with no example secrets.                                                          |
| Do other brokerages work?                        | Generic SnapTrade readers existed, with uneven available fields.                                                                     | Requires documentation/provider capability verification. No universal live brokerage certification is claimed.                                                     |
| Are local files/databases required?              | Optional ignored CSV imports and browser artifacts existed; no database.                                                             | Ready for distribution: no personal file required, absent folder supported, uploads are temporary.                                                                 |
| Is publication private?                          | Ignored credential/CSV files and server-only boundaries existed; older reports contained actual aggregate audit metadata.            | Requires manual history decision. Current documents are generalized; historical metadata remains.                                                                  |
| Is setup reproducible?                           | Supported versions and clean-copy checks were missing.                                                                               | Ready at the code/setup level on the tested host; cross-platform validation limits below apply.                                                                    |
| Are rights confirmed?                            | No root license; hosted provider terms are separate from SDK licensing.                                                              | Requires owner license approval and external provider confirmation.                                                                                                |

## Authentication and boundaries

`src/server/snaptrade.ts` is the sole SDK initializer. Installed version 13.1.11 documents `SnaptradeAuth.personalApiKey({ clientId, consumerKey })`; application calls match that mechanism. The [official Personal model](https://docs.snaptrade.com/docs/personal-vs-commercial) omits Commercial user registration and per-request user credentials. Only the explicit read adapter is exposed. There are no order submission/cancellation, fund-transfer, registration or Connection Portal generation endpoints. Users connect through their own SnapTrade dashboard, choosing read-only permissions where available.

`lib/config.ts` validates environment values; server code retains credentials and sends only a safe public settings subset to the client. Missing/invalid values generate setup guidance without printing their values. `npm run check:config` makes no network request and does not verify provider acceptance. Browser credential entry is not implemented. Existing credential-scoped caches do not cross installations; this is not multi-tenant authentication.

## Security and privacy audit

The initial read-only scan covered all nonignored working files and **594 unique blobs reachable from local Git refs**, plus the available browser bundles. It checked common credential/token patterns and exact matches for the configured local credentials and account identifiers read privately from existing exports. It emitted no secret values. No matching credentials, known local account identifiers, tracked CSV files or tracked environment secrets were found. No credential compromise was established, so external rotation was not performed.

Manual review did find **connection-derived aggregate counts, coverage dates and aliases in earlier audit documentation**. These are financial metadata even without raw transactions or names. The current `history-recovery-audit.md` and `holding-returns-recovery.md` were rewritten as generalized engineering notes. Earlier commits still retain the prior summaries. The owner must decide whether to remove them through an approved history rewrite or distribute a reviewed fresh history. No automatic rewrite is authorized.

The redacted `npm run check:distribution` utility now checks working files, reachable Git blobs, common token patterns, current configured-secret matches, client bundles and private deployment trace paths. It is deliberately not a full DLP/image scanner. It cannot detect all financial statistics, unknown credentials, copied images, provider/server logs, unreachable objects or remote refs not present locally. It also does not remove Git author names/emails; review that metadata privately before publication.

Default dev/start scripts already bound to loopback. `src/proxy.ts` now rejects unexpected Host values, cross-site fetches and mismatched Origin authority/protocol, mitigating local DNS rebinding and browser access from another origin. No remote authentication was introduced. The CSV endpoint remains stateless, bounded and same-origin, with no brokerage access or persistent/shared import store. It rejects uploads in demo mode. No-store/private response headers and server-only modules remain in place.

`.gitignore` additionally covers logs, database files, private keys, local audits and common test artifacts. Optional local CSVs remain outside public assets and deployment traces. Fonts are local. Optional Logo.dev URLs disclose ticker requests and network details to that provider; the publishable key is intentionally public. Bank of Canada rate requests and SnapTrade remain external live-mode dependencies. Balance hiding is display-only, with a preference cookie.

## Changes implemented

- Node 24/npm 11 engines, `.nvmrc`, complete empty-value environment template, configuration utility and safe first-run guidance.
- Configurable reported/USD option policy and optional HYSA label. Generic defaults do not invent product type, yield or missing currency. The existing operator's USD/HYSA settings were added only as nonsecret preferences to ignored local configuration; credentials were not replaced.
- Explicit demo mode across all eight page routes, including production. Existing fictional view models are reused. Live errors do not select demo fixtures; demo never invokes live page loaders or local exports and disables CSV uploads.
- Loopback Host/origin guard, existing read adapter preserved, and clearer provider-rejected-read messages.
- Public-oriented README, contribution guidance, safe issue/PR templates, security reporting guidance, third-party inventory and retained full OFL notices. No project license was applied.
- Lightweight GitHub Actions installation/lint/types/unit/build/distribution checks with no financial secrets or live API calls. Unit tests explicitly reset inherited live credentials and settings and use mocked services.
- Source sanitization of prior personal audit notes, credential-free clean-copy installation validation and synthetic demo screenshots.
- A source-only export command rejects dirty trees, private tracked files, symlinks and overwrites; it omits Git history and supports a private review snapshot while license approval is pending. See [the release checklist](release-checklist.md).

## Configuration and new-user setup

See the [README](../README.md) for complete commands. Clone the intended repository, use Node 24/npm 11, run `npm ci`, copy `.env.example` to a new `.env.local`, and enter only your own Personal keys in your local editor. Run `npm run check:config`, verify `git check-ignore .env.local`, run `npm run dev` and open the printed loopback URL. Connect your own brokerage in SnapTrade if needed.

Required in live mode: `SNAPTRADE_CLIENT_ID`, `SNAPTRADE_CONSUMER_KEY`. Optional: `HOLDINGS_DEMO_MODE`, `HOLDINGS_OPTIONS_CURRENCY`, `HOLDINGS_CASH_ONLY_AS_HYSA`, `LOGO_DEV_PUBLISHABLE_KEY`. No Commercial credentials, database, private export, maintainer account mapping or cloud service is required. Use explicit demo mode to explore without keys.

## Verification scope

Validation is performed with independently synthetic fixtures and an isolated temporary source copy excluding `.env.local`, private-data, screenshots, build output and installed dependencies. This simulates a fresh checkout on the same macOS host, not a newly provisioned physical machine. Executed results:

- `npm ci` succeeded in the isolated copy with registry access (405 installed packages). An initial offline attempt could not resolve optional peer metadata; offline installation is not promised. The original setup retained dependency versions; the finishing pass patches only the scoped minimatch dependency and validates the resulting lockfile.
- Lint, TypeScript, formatting, 442 unit tests across 56 files, and production builds passed. The credential-free clean copy also passed lint/types and its synthetic suite, then built successfully.
- Desktop regressions passed: 21 dashboard/accessibility checks plus nine Options Analytics/upload checks. An added setup link's underline and setup-banner placement were corrected after the first accessibility pass.
- All eight production demo routes returned HTTP 200 with the explicit fictional-data notice and zero axe violations. No external browser requests occurred. Demo upload, cross-origin and unexpected-Host requests returned HTTP 403. Demo-route unit tests also prohibit live fetches and disable SDK/export access.
- With demo off and no credentials, Overview, Accounts and Options Analytics returned HTTP 200 with useful local setup guidance and zero axe violations. A synthetic EUR CSV import worked with the generic reported-currency setting and no brokerage credentials.
- The redacted distribution scan reported no configured-secret/common-token/path matches in reachable history or browser bundles; private-file references in deployment traces were absent. This scan does not clear the manually identified historical aggregate metadata.
- YAML workflow/issue templates parsed locally. Hosted CI has not run. Synthetic README captures were visually inspected; no private screenshots were used.

Hosted GitHub Actions execution, a second person's live key, Windows/Linux native installations and provider approval cannot be proven by local mock tests.

Production dependency advisory checks returned no reported vulnerabilities at audit time. The initial full dependency audit reported 16 moderate affected/dependent development entries arising from one minimatch denial-of-service advisory, with no high or critical entries. The named-API path used by typescript-estree is now patched to minimatch 11.0.3 via a scoped override. The registry still reports 15 moderate development entries on the legacy 3.1.5 path. A blanket API-breaking override was not applied; compatible legacy/toolchain remediation remains an upstream/review task. The installed development linter also emits a deprecation warning; the legacy linter has not been force-upgraded. Advisory data changes over time. Full dependency/license review remains a release responsibility.

## Remaining limitations and publication gates

1. Approve an application license and correct ownership notices. MIT is recommended for consideration, not applied. Until then do not describe this as licensed open source.
2. Review/remove historical private aggregate audit metadata using a separately approved history strategy. Review author metadata, tags/branches/remote refs and any previously published artifacts. Run credential and artifact checks again on the exact release candidate.
3. Obtain SnapTrade confirmation for independent local-copy distribution using each operator's Personal API credentials. The [Build with AI guide](https://docs.snaptrade.com/docs/build-with-ai) recommends OAuth when connecting other Personal users; this project does not implement such a hosted flow. Also clarify market-data memory reuse and application compliance terms. See [third-party notices](third-party-notices.md).
4. Enable and test GitHub's private vulnerability-reporting/advisory channel, or establish a real private contact method. No address or service-level promise has been invented.
5. Review the exact dependency/asset licenses, trademark/name use and optional Logo.dev plan requirements. Confirm synthetic documentation captures before publishing. No proprietary font or financial screenshot should be added.
6. Remediate the development-tool minimatch advisory with compatible dependency updates and re-run the complete checks before release. Production-only audit currently reports zero vulnerabilities.
7. Existing financial limits remain: inconsistent provider fields, incomplete history, shorter account-value windows, absent Greeks/IV, unverified settlements/basis, daily CAD/USD conversion estimates, CAD/USD-focused aggregates and a Wealthsimple-specific CSV schema. Source completeness is never inferred from pagination alone.

After these manual steps and a clean recheck, the project can be reassessed for publication. This report does not authorize publishing, pushing, changing repository visibility or rewriting history.

## Finishing pass

The finishing pass adds a scoped minimatch 11.0.3 patch, production-only CI advisory checks, and the gated source exporter. Lint, types, formatting, production build, and 448 tests across 57 files passed. A fresh npm ci installation with the updated lockfile also passed lint, types and all 448 synthetic tests. Six exporter regressions cover private inputs, license gating, dirty trees, tracked symlinks and overwrite prevention. The refreshed redacted distribution scan reported no matches. Exporting a clean tree is an alternative to rewriting this repository; no historical commit is modified. Provider approval and a private reporting channel must still be confirmed externally, and the license requires explicit owner approval. [The release checklist](release-checklist.md) includes exact commands, a provider question draft, reporting-channel steps and remaining audit limitations.
