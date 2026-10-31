# CSV reconciliation for holdings and options

October 31, 2026. Local Wealthsimple activity exports now supply evidence to both **Performance → Holding returns** and **Options Analytics**. This extends the earlier preview; it does not add a database, paid service, trading operation or external upload.

## Results and limitations

Both pages show source-scoped reconciliation results at runtime. Live import counts and financial records are deliberately omitted from tracked documentation; they belong in the private app or local diagnostics.

Holding Returns can recover eligibility when uniquely matched source cash or independently reconciled stock additions supply missing evidence. Rows still lacking original cost, ownership history or supported settlements remain unranked. Options can calculate supported closed lifecycles from the CSV cohort; incomplete openings, assignments/exercises and missing settlement cash remain excluded.

CSV-based trade figures include each trade's reported commission but exclude unallocated account/FX fees. They are not whole-account net profit. A count of fee observations does not establish distinct additional charges.

Live read-only verification emitted counts and status flags only. No account names/IDs, ticker values, transaction amounts or raw financial payloads were logged. Tests and screenshots use synthetic data exclusively.

## Account and execution matching

The shared reconciler matches date, security/OCC symbol, action, absolute quantity, native currency and reported cash/commission. Exact trade dates take precedence. A unique matching settlement date can identify delayed booking within seven days; ambiguous matches remain review items. Multiple independent trade identities must corroborate account membership, and competing source accounts cannot silently claim the same target. Raw source account IDs remain server-side.

Identical files are skipped. Repeated source rows are held for review; a second CSV claim cannot overwrite the first interpretation of an API execution. Cash or action disagreements are not automatically merged. Nonmatching securities, unsupported types and partial API histories do not provide a shortcut to eligibility. No current market value or current average cost is used to invent historical cost.

## Holdings source policy

Existing trades receive matched CSV net cash and commission with provenance, so commission is not subtracted twice. CSV-only stock rows need a known security, an unambiguous account match and an independently reconciling ending share count. Unknown transfer directions/corporate actions prevent that check; these rows remain pending. The original API pagination coverage stays separate from CSV evidence.

Broker-native option assignment labels previously caused underlying stock settlement records to be filtered out. The parser now distinguishes underlying share cash from option-contract events. Uniquely matched CSV stock legs can classify supported settlement records without treating an option premium as stock purchase cost. Observed expiry/assignment aliases are normalized; unknown native labels remain unsupported until evidence identifies them.

Transfer rows without a security symbol cannot be treated as share transfers. Cash movements cannot establish original share-transfer purchase cost. A generic transfer matcher may use a signed share quantity only when a security is identified and the API independently confirms zero cash/fee. A CSV transfer valuation is never substituted for historical basis.

## Options source policy

Options Analytics now treats a supplied Wealthsimple CSV as its **entire primary historical ledger**. It works without API history or verified account mapping. Source accounts use aliases and stay separate from current brokerage snapshots. API option fills are not appended, even outside the export window, so uncertain overlaps cannot double-count trades. Without CSV options, SnapTrade remains the fallback source. This policy applies to both the existing private-folder import and the temporary page upload. Holding Returns keeps the account-matching safeguards described above.

BUY/SELL combined with the CSV's LONG/SHORT side produces a **derived classification**, not an explicitly supplied opening/closing instruction. The original side and action remain visible. Exact decimal trade cash uses `net_cash_amount` and `commission`; gross premium is net cash plus commission. No multiplier is defaulted to 100. Missing cash/fees and incomplete openings remain review items. CSV-first mode does not borrow absent settlement fields or execution quotes from SnapTrade; entry/exit per-share prices can remain unavailable. Historical Greeks/IV are not recovered by an activity export.

CSV clock times order transactions within their common export clock without creating UTC timestamps. Missing/equal times still require reconciliation. Identical files are skipped; repeated rows are held for review. Export the fullest available period, because source preference does not prove lifetime completeness.

Installation policy: `HOLDINGS_OPTIONS_CURRENCY=reported` (the default) retains native currencies; explicit `USD` enables the original personal USD assumption using `lib/options/currency.ts`. This is an assumption about denomination, not an exchange-rate conversion. Source amounts, original reported currency metadata and raw account/execution matching remain intact. Stock and cash currencies are unaffected.

## Privacy and storage

Only the original user-supplied exports persist in `private-data/wealthsimple/`. That folder and CSV files are git-ignored, and exports are excluded from Next.js deployment tracing. Parsed records, account matches and normalized ledgers are rebuilt in memory. The stateless `/api/options-import` endpoint accepts same-origin temporary uploads and returns only calculated display data, without credentials, disk storage or a shared session. It does not serve files or read local-folder exports. See the private import instructions for its limits and lifetime. Removing an export removes its contribution on the next page load; never force-add real exports or copy them into fixtures.

See [private import instructions](private-imports.md) for placement and Git verification. Both pages show source scope and unresolved evidence; Holding Returns retains its reconciliation counts. Unranked holding rows indicate when CSV activities were matched but cost/history gaps remain.

## Validation

410 unit tests across 51 files and 27 desktop browser checks passed. A focused rerun confirmed CSV-source metric availability, expanded-preview accessibility and hidden balances after final scope labels. Lint, TypeScript, formatting and production build passed. Live page checks confirmed both routes rendered the applied CSV reconciliation with no browser errors; only status flags/counts were emitted, with no real screenshots or financial-value logs. Git checks found no tracked private exports, and production file traces contained no private-export references.
