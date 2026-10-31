# Historical data recovery audit

October 31, 2026 · desktop-first · SnapTrade SDK 13.1.11. This audit preserves the pending Phase 2 implementation. No database, provider subscription, account synchronization mutation or trading operation was introduced.

## Generalized findings

Private connection-derived counts, dates and account aliases have been removed from this working document for distribution. Earlier commits still contain aggregate audit metadata; publication requires the owner's history review. No rewrite is performed automatically. Current diagnostics belong in ignored local artifacts, not public documentation.

Available transaction history can span multiple years while account-value history has a shorter window. Successful pagination establishes only that the available API pages were consumed, not that the brokerage supplied every lifetime event. Holdings and transactions have separate sync metadata; provider account creation is not brokerage account opening.

Options BUY/SELL activities may lack explicit opening/closing intent, multipliers and contract metadata. Broker-native expiry/assignment aliases require normalization. Missing basis, fees or settlements cannot be replaced with zeros, and recent cumulative orders do not repair earlier fills. Compare official exports or ask the provider when source evidence is incomplete. Options Analytics can now use an independent CSV-first ledger; see [source policy](csv-reconciliation.md).

## Limits by source

| Request / source                      | Existing use                                | Limit / interpretation                                                                                                                                              |
| ------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/accounts/{id}/activities`, no dates | Funding, holding returns, Options Analytics | May span multiple years. Page limit is 1,000; no one-year date filter is sent.                                                                                      |
| Same endpoint, startDate + limit 25   | Overview and Activity's recent feed         | Deliberate 90-day, first-25 display scope; not the full historical ledger.                                                                                          |
| `/accounts/{id}/recentOrders`         | Activity orders                             | Last 24 hours, latest page (typically up to 100). It is not the general orders endpoint.                                                                            |
| `/accounts/{id}/orders`               | Not currently requested by the app          | General endpoint supports days, default 30, capped at 90. It cannot recover years of executions.                                                                    |
| `/accounts/{id}/balanceHistory`       | Overview and Account performance            | Provider-generated **beta estimates**, with an approximately one-year source window and possible gaps/schema changes. Not a complete brokerage valuation statement. |
| `/accounts/{id}/positions/all`        | Current holdings / option contracts         | Current snapshots, not historical positions, fills or entry Greeks.                                                                                                 |
| Account list + connections            | Filtering, status and synchronization       | Transactions and holdings have separate synchronization metadata. SnapTrade account creation is not brokerage opening.                                              |
| Legacy returnRates                    | Existing optional reported-return section   | Deprecated/unreliable; not a substitute for value history or a transaction ledger.                                                                                  |

Official references: [activities](https://docs.snaptrade.com/reference/Account%20Information/AccountInformation_getAccountActivities), [general orders](https://docs.snaptrade.com/reference/Account%20Information/AccountInformation_getUserAccountOrders), [recent orders](https://docs.snaptrade.com/reference/Account%20Information/AccountInformation_getUserAccountRecentOrders), [beta account values](https://docs.snaptrade.com/reference/Account%20Information/AccountInformation_getAccountBalanceHistory). Activities are provider-cached daily; re-reading is not forcing a brokerage synchronization.

A source window and an application pagination limit are separate constraints. Transaction pagination now has no fixed year or record-count cutoff, but time budgets and incomplete sync remain explicit limitations. This generalized report does not include a personal connection's coverage dates or totals.

## Safe corrections implemented

- Removed the ten-page/10,000-record cutoff. Requests advance by actual page length, including short pages. Without an advertised total, an explicit empty page confirms the end. Returned offsets, totals, duplicate identities and progress are validated. A two-minute per-account read budget flags partial coverage rather than silently declaring completion.
- Identical repeated IDs are deduplicated; changed records under the same ID or a repeated page with no progress remain blocking. Distinct fills are never merged merely because their amounts match.
- Successfully retrieved records and coverage survive later failures. Funding error results now retain partial evidence while calculations still reject the error status. Holding/option journals keep successful rows with exclusions. No upstream response body or error text is surfaced.
- Whole-history requests share in-flight and completed reads across credential-scoped adapters, including Performance's wrapper. Completed histories remain in server memory for up to 60 seconds; partial reads for 10 seconds. Changed transaction-sync metadata invalidates cached reads. The cache is bounded to 100,000 records/100 entries, removed on process loss, and never written to disk. Existing concurrency, 429 cooldown and no-auto-retry rules remain.
- Added explicit source retrieval times/cache labels. A manual Refresh within the history TTL can reuse the snapshot; this is disclosed in coverage. Current snapshot retrieval time is not presented as a new historical read.
- Preserved transaction initial-sync flag, first date and last-sync date independently of holdings. Options eligibility no longer rejects valid older transaction evidence just because today's holdings are stale. Incomplete transaction sync still blocks dependent performance.
- Preserved raw equity/underlying symbols, option ID and the mini-option flag as source metadata. No missing exchange-qualified ticker or multiplier is guessed from them.
- Added reusable coverage disclosures to Options Analytics, Holding Returns, Account Performance and Overview's history details: dated observations, unique/API counts, page completion, sync state, field gaps, duplicates, cache age and source limitations. Pagination success never becomes a 100% brokerage-completeness claim.
- Labelled the connected valuation source as SnapTrade beta estimates. No valuation or P&L formula was relaxed to manufacture a result; eligibility/duplicate handling changed only with the evidence and tests described above.

## Recovery beyond the returned data

Available older transaction rows can support eligible funding and stock-return calculations. Earlier account-value curves cannot be reconstructed from those rows alone. Reconstruction needs starting cash/positions, complete corporate actions and cash flows, historical security/option prices and dated FX; provenance must identify estimates rather than broker-reported values.

Recommended source classes for future history are distinct: directly broker-reported statements, observed local snapshots with actual capture/as-of times, source-generated beta estimates, internally reconstructed estimates with versioned inputs, and unavailable periods. Never forward-fill today's portfolio into missing years. Do not stitch changing beta reconstructions together as if they were historical observations.

See [the existing local storage proposal](historical-storage-plan.md) for future daily capture. It still requires approval before any durable brokerage-data collection. No paid historical pricing provider is connected. Local snapshots extend future coverage; they do not recover missed past observations or entry Greeks.

## Wealthsimple import fallback design

Wealthsimple's [official document guide](https://help.wealthsimple.com/hc/en-ca/articles/35654428540571-Request-a-custom-statement) supports custom activity CSV/PDF, holdings CSV and realized gain/loss CSV. The custom activity statement covers selected accounts/periods and can include expiry, exercise and assignment. The realized report covers per-security results, including options; it is an aggregate source, not proof of an execution-level win rate. The documented formats do not establish exact CSV column names or guarantee explicit open/close flags.

The useful fallback has two separate inputs:

1. **Activity / trade-confirmation evidence:** recover missing historical executions, directions, fees, contract details and settlement events when those fields actually exist. If an export still contains only buy/sell, keep opening/closing intent unresolved.
2. **Reported realized gain/loss:** display the broker's reported period/security/native-currency totals as a separate source for comparison. Do not invent trade counts, lifecycles, fee treatment or strategy statistics from aggregate totals.

Proposed workflow, without a database:

1. Read a local CSV into an in-memory preview. Detect encoding/delimiter/quoted records, reject malformed files and validate recognized versioned headers. Exact mappings require a real local header/schema review; no column names have been invented here.
2. Require explicit account selection and native-currency mapping. Preserve decimal text, date precision, source type, document hash, row number and provenance. Imported figures must not masquerade as SnapTrade fields.
3. Prefer verified execution identifiers for deduplication. A related brokerage reference may group multiple fills/fees, so it is not a unique fill ID. Otherwise generate candidate comparisons from account/contract/action/date/quantity/price/fee/currency and require unambiguous one-to-one agreement. Repeated fills or competing matches go to review.
4. Preview new, already-matched, conflicting, unsupported and unresolved records with masked sensitive values. Never overwrite source facts or auto-sum conflicting API/import rows. Produce redacted row/error codes instead of logging financial payloads.
5. Only explicitly accepted, reconciled records enter a working ledger. Importing never invokes any brokerage mutation. An in-memory import is lost when the session/process ends; saving imports/history requires separate approval.

CSV and broker confirmations can materially improve accuracy **if** they add missing action/contract/fee evidence or documented reported P&L. More rows alone do not fix missing intent. Prefer structured CSV; no OCR or automatic PDF extraction was implemented or justified. PDF statements contain personal details and require careful local review.

## Validation

Synthetic regression tests cover more than 10,000 transactions over multiple years, short pages, absent totals, offset mismatches, duplicates/conflicts/no-progress, partial-page retention, cache expiry/scoping/concurrent reuse and synchronization invalidation, rate limits, missing metadata, field applicability and source-identifier preservation. Diagnostic tests verify that identifiers, ticker values, monetary values and upstream exceptions cannot appear in the output whitelist. Initial transaction synchronization gates funding and holding-return eligibility while preserving available evidence. Existing financial calculations and Phase 2 desktop behavior remain covered.

Final executed checks, including the loading repair below: **349 unit tests across 46 files**, **24 desktop browser checks**, lint, TypeScript, formatting and production build all passed. Browser regression tests used synthetic previews exclusively; live checks emitted only redacted diagnostic metadata and route pass/fail results.

## Options Analytics loading repair

After the historical audit, the reported route failure was reproduced without screenshots or financial payload logging. The real `OptionsLoading` fallback supplies an empty update timestamp; the shared `StatusChip` formatted it unconditionally and threw `RangeError: Invalid time value` before the dashboard could load. Synthetic previews had valid timestamps and therefore missed this case. The chip now skips date formatting while loading and displays an unavailable label for missing/invalid timestamps. Tests exercise the actual fallback and invalid/valid timestamp cases. A live read-only check then confirmed HTTP 200, a rendered journal, no error boundary and zero browser page errors. No real-data screenshots, traces or videos were saved.
