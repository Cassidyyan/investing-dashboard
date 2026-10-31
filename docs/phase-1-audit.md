# Phase 1: architecture and financial foundations

Audit date: October 31, 2026. Scope: the seven existing pages, their loaders, calculations, shared controls, SDK schemas, fixtures and test tools. Existing uncommitted UI work was preserved. No brokerage credentials or live account records were inspected.

## Architecture and strengths

The repository uses Next.js 16.4.3 App Router, React 19, TypeScript, CSS Modules and SnapTrade SDK 13.1.11. Its routes are `/`, `/accounts`, `/cash`, `/holdings`, `/performance`, `/returns` and `/activity`.

```text
Server route → feature loader → server-only read adapter → SnapTrade
                         ↓
                 source normalization
                         ↓
             pure financial/view helpers
                         ↓
             shared and feature components
```

The server/client boundary is already useful: one SDK initialization module exposes read methods, loaders preserve independent section failures, and local filters/ranges/disclosures do not query the broker. Teal tokens, Money, balance privacy, cards, selectors, disclosures and refresh controls are shared. There is no reason to rewrite the pages or add a state-management dependency.

## Prioritized findings and disposition

| Priority | Finding                                                                                                                                          | Phase 1 action                                                                                                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0       | Unavailable USD cash rendered as `0`, indistinguishable from a reported zero.                                                                    | Missing cash now displays Unavailable; actual USD zero still displays `0`. This intentionally supersedes the earlier display preference.                                                            |
| P0       | Negative security prices or nonpositive option multipliers could create plausible valuations.                                                    | Invalid inputs produce unavailable calculated values. Positive unusual multipliers and legitimate short quantities remain supported.                                                                |
| P0       | Funding and holding-return pagination had different validation; invalid/changing totals or repeated records could undermine historical coverage. | One bounded reader checks identity, scope, page shape, totals, duplicates and completeness. Failed coverage blocks dependent returns while successful independent sections remain.                  |
| P0       | Missing order/activity arrays looked like successful empty results; malformed account data could discard connection status.                      | Explicit arrays are required. Malformed account lists return a safe section error independently of connection results.                                                                              |
| P0       | Invalid sync timestamps and overflowing totals could look usable.                                                                                | Invalid sync dates become incomplete/unavailable. Nonfinite currency aggregates are marked incomplete.                                                                                              |
| P0       | Browser checks could use the real Activity page.                                                                                                 | Added explicitly synthetic development-only Activity states; all seven browser test routes require a Sample data banner for default checks.                                                         |
| P1       | Transaction normalization was repeated and discarded native source amounts needed for FX reconciliation.                                         | Shared provenance-aware transaction/order normalization, bounded decimal strings, dates and scalar source retention. Lifetime-return working copies retain their original normalized source record. |
| P1       | Options used several incompatible SDK shapes and had no execution/lifecycle boundary.                                                            | Shared contract parser/model, explicit order snapshots, quantity-only execution matching and future lifecycle/strategy/repository interfaces. No options accounting/UI added.                       |
| P1       | Historical entry Greeks were not available through the connected adapter.                                                                        | Entry delta has explicit observed/manual/estimated/unavailable provenance. The current adapter always sets unavailable; it never reads current Greeks as entry delta.                               |
| P2       | Refresh protection existed but header parsing and configuration needed hardening.                                                                | Case-insensitive Retry-After parsing, bounded numeric validation, positive-integer concurrency checks; existing in-flight deduplication/queue/cooldown retained.                                    |
| P2       | Exclusion membership repeatedly scanned the full list.                                                                                           | Set membership replaces the repeated scan; allocation scope is unchanged.                                                                                                                           |
| P3       | Durable history, entry observations and annotations will need retention beyond provider lookbacks.                                               | [Local storage proposal](historical-storage-plan.md), without a database, collection job or persistence implementation.                                                                             |

## Financial normalization and provenance

`lib/types.ts` remains the compatible UI contract: AccountView carries masked suffix, institution/type, reported Money, sync/incomplete/stale state; BalanceView separates cash from buying power; PositionView keeps account membership through AccountData and separates price, average cost, calculated value and unrealized return. Existing investing/cash/history account filters are retained.

`lib/financial/` supplies shared validation, exact decimal operations, source-field status, normalized transactions and cumulative order snapshots. New financial fields distinguish confirmed source reports, calculated results, estimates, missing and unsupported data, with source/method provenance. Confirmed does not mean independently verified against a brokerage statement.

The existing UI has not been migrated wholesale to the richer field union. Its numbers remain `number | null`, with reported/estimated labels, coverage and timestamps in existing view models. This avoids a risky cross-page rewrite; new accounting should consume decimal/provenance records rather than treating UI projections as a ledger. Unknown three-letter currencies remain native; syntactic code validation is not an ISO registry lookup.

Transaction source retention is a whitelist of financial scalar values and raw dates, not a copy of the brokerage response. Account identity is scoped to the requesting account. It is held in memory only. Fees missing from the source remain missing; the adapter does not guess gross/net amounts or silently apply a source FX rate whose orientation is not established.

## Formula review and precise changes

The unified `AccountPosition` schema describes `cost_basis` per share. This differs from the legacy option-position schema's per-contract average purchase price; the app uses the unified endpoint. Its existing formulas remain:

- Market value = quantity × price × instrument multiplier.
- Unrealized return = (price − average cost per share) × quantity × multiplier.
- Unrealized percentage = unrealized return / absolute invested cost × 100, when invested cost is positive.

Those products and differences now use exact base-10 strings before projecting to the UI; for example `0.1 × 3` yields `0.3`, not `0.30000000000000004`. Invalid prices/multipliers are rejected. Division/percentage projection and legacy portfolio/return calculations still use finite JavaScript numbers. This is a foundation, not a claim that the entire application is a decimal accounting engine. A number already rounded by JSON parsing cannot be recovered.

The audit retained the existing average-cost lifetime profit, dividend/charge attribution, unique internal share-transfer carryover, gain-versus-net-deposits and Modified Dietz formulas. Nonzero transaction trade fees continue to require reconciliation because the feed does not guarantee a universal gross/net amount convention. Premium received is not realized profit. Options/shorts are still excluded from the stock lifetime leaderboard.

Current combined estimates still use USD + CAD / CAD-per-USD. Historical FX still uses dated Bank of Canada observations with explicit estimate notes; current rates do not fill historical gaps. Native source currencies survive conversion of a working record. Bank of Canada publishes reference rates rather than brokerage execution quotes: see its [daily rate methodology](https://www.bankofcanada.ca/rates/exchange/daily-exchange-rates/).

Reported account totals, cash-plus-position estimates and positive-position allocation can legitimately differ in scope, currency, valuation convention and snapshot time. They were not forced to agree. Unsupported instruments remain unvalued; the preexisting narrow PHYS.TO exception is retained.

## Requests, freshness and performance

No new provider calls or background polling were added. The shared history reader preserves page size 1,000, a 10,000-record ceiling and sequential history pagination. It rejects repeated IDs rather than summing them twice; a repeated page cannot be assumed complete. Earlier rows may remain available with an explicit account-history issue. Funding estimates require complete available coverage.

The existing process/credential-scoped guard shares identical in-flight reads, allows three concurrent reads and bounds the queue at 100. A provider 429 holds queued/new reads using Retry-After or a 30-second fallback; no automatic retries occur. Completed brokerage responses are not cached. Consequently sequential navigation can reread account snapshots; a future short-lived cache must disclose snapshot age, invalidation and refresh semantics before being introduced. This is a deliberate remaining optimization, not an invisible stale-data fallback.

The provider itself caches some data and can return its last state for disabled connections. Refreshing this app is not a forced brokerage synchronization; [SnapTrade's activity reference](https://docs.snaptrade.com/reference/Account%20Information/AccountInformation_getAccountActivities) documents that distinction. Existing connection/sync warnings must remain visible. Protection is per Node process, not distributed across deployments.

## Changed files

- Domain: `src/lib/financial/{decimal,validation,fields,types,transactions,orders,position-values}.ts`; `src/lib/options/{types,contracts,reconcile-executions}.ts`.
- Adapters/loaders: `src/server/{normalize,normalize-transactions,transaction-pages,load-portfolio,load-account-funding,load-holding-returns,retry-after,request-protection}.ts`.
- Compatible helpers: `src/lib/{format,accounts/currency-totals,holdings/holdings-view,performance/performance,returns/holding-returns}.ts`.
- Synthetic QA: `src/dev/previews/activity-preview.ts`, `src/app/activity/page.tsx`, ActivityDashboard's optional preview branch and `tests/browser/dashboard.pw.mjs`.
- Screenshot QA: `screenshots-tool/capture.pw.mjs` now recognizes the shared Sample data banner; strict preview mode had rejected all routes using the former banner wording.
- Regression tests: financial/options helpers, normalization, transaction pagination, partial failures, native FX source retention, currency totals, missing cash and request protection under `tests/lib/` and `tests/server/`.
- Documentation: this audit, options capabilities, storage proposal, README, project guide, security/data notes and screenshot instructions. Other dirty files predate this Phase 1 work.

## Validation and limits

Baseline: lint/type checks and 212 unit tests passed before Phase 1 edits. Final validation:

- `npm run lint`, `npm run typecheck`, `npm run format:check` and `npm run build`: passed.
- `npm test`: 290 tests passed across 38 files.
- `npm run test:browser`: 51 checks passed across desktop, tablet and mobile, covering all seven synthetic routes, shown/hidden balances, loading/empty/error states, keyboard disclosures, sorting and refresh cooldowns. Axe found no violations in tested states.
- `SCREENSHOTS_DATA_MODE=preview npm run screenshots`: 10 synthetic captures, zero failures, all seven routes reachable; desktop axe reports contain zero violations. Contact sheet: `screenshots/2026-10-31T04-47-43-814Z/index.html` (git-ignored). An initial strict-preview run captured zero images because the detector still expected the previous banner text; the selector was corrected before the successful rerun.
- `git diff --check`: passed. `.env.local` and screenshot outputs verified ignored; no new dependencies were installed.

Added regressions cover exact fractional valuation, invalid inputs/multipliers, native FX source preservation, malformed responses, duplicate/changing history, missing account metadata, long/short quantities, partial opens/closes, separate roll legs, uncertain ordering, timezone-aware execution ordering, unresolved expiration/assignment/exercise and missing entry Greeks. Existing recent-first Activity ordering and ticker-description fallback were retained and regression-tested through the shared adapter.

All added fixtures are synthetic. No production broker-data verification, account-entitlement probe or historical statement reconciliation is claimed. Automated accessibility checks cover these states and do not replace manual assistive-technology review.

Remaining risks include legacy floating-point accumulation, uncertain fee semantics, provider history gaps/changes, absent historical entry Greeks and per-fill order identities, and no durable local history. The local app has no remote authentication; balance hiding is display privacy, not authorization. No database, trading capability, paid service, telemetry or major analytics page was added.

## Phase 2 sequence

1. Confirm contract multipliers, transaction cash/fee semantics and assignment/exercise settlement using authorized source records before calculating options realized P&L.
2. Make every account/contract coverage issue an eligibility gate; build an auditable closed-trade journal from reconciled activities, not order snapshots.
3. Define premium received, net premium retained and realized P&L separately, including fees and settlement outcomes; only then add the Options Analytics MVP.
4. Prioritize a decision on legitimate entry-Greeks capture earlier than Phase 5. Historical entry observations not captured now may be unrecoverable. Provider access and local persistence need separate approval; see the storage proposal.
