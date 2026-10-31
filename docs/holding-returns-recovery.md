# Holding Returns recovery

October 31, 2026. This follow-up preserves the historical pagination and rate-limit protections from the [history audit](history-recovery-audit.md).

## Verified result

The connected Holding Returns dataset contains 57 security/currency rows across 17 investing-history accounts. Before this fix, 23 could be ranked and 34 could not. After the fix, **37 can be ranked and 20 remain unresolved**. These counts span both currency cohorts; the page shows the currently selected cohort. Reason counts overlap because a holding can have several issues and accounts.

Every requested transaction history completed pagination. Historical Bank of Canada rate loading succeeded without conversion warnings. This was not another one-year filter or pagination failure.

## Corrections

- Old, empty investment accounts were applying a stale-current-holdings error to fully sold or transferred holdings, which then blocked the entire aggregated security. A closed holding now remains eligible only when API pagination and transaction initial synchronization completed, source metadata is valid, every evaluated activity predates the brokerage holdings-sync date, the snapshot has no nonzero/unknown position for that security, and the ledger reconciles to zero. A newer API response timestamp alone is insufficient. Open holdings retain the freshness requirement. The explanation appears in calculation notes.
- The original transfer matcher supported only one move per account/security. Repeated internal moves now carry original recorded average purchase cost across a chronological chain, without creating a new purchase or profitable sale. Matching requires unique counterpart legs within the same institution, date, security and currency, zero cash/fees, known source basis, conservation of shares and a single direction path consistent with every ending quantity. Simultaneous dependent events, multiple valid paths, missing counterparts, unsupported actions, unknown fees or inconsistent endings remain blocked. Search is bounded to 12 paired moves per security/institution group. Existing single-pair behavior remains available.
- Missing purchase evidence is no longer presented as proof of short selling. Reason popovers now identify affected accounts, available activity dates and the first source event, then explain the specific supporting records or synchronization action needed.

These changes affect eligibility and transfer reconstruction, not the definition of return: realized plus unrealized profit plus reported dividends minus separately attributed charges. Return percentage still divides by original purchase cash outflows. No current average cost, market price or deposit was substituted for missing historical purchase cost.

## Remaining evidence gaps

The remaining records include histories starting with a sale or a transfer rather than the original purchase, share totals that do not reconcile, an unmatched transfer and dividend/charge-only histories without ownership cost. A follow-up checked all 16 accounts excluded from the investing-history scope, including zero-balance accounts: all completed activity pagination and contained no additional normalized stock transactions. No security identifier was observed with competing ticker names, and current instrument identifiers did not reveal a ticker-join mismatch. Returned history can span years while still omitting an opening lot or a corporate action. The earliest returned record is not the account-opening date.

For these holdings, compare Wealthsimple activity exports and trade confirmations with the reason popover: opening quantities/costs, both transfer legs, split or reinvestment adjustments, and missing executions are the useful evidence. The current SDK response cannot safely supply an absent purchase merely from a later sale or current value. The subsequent [CSV reconciliation](csv-reconciliation.md) now uses matched net cash and independently reconciled stock additions, while holding ambiguous additions for review. Live import counts stay out of tracked documentation. Cash-transfer rows cannot supply share-transfer purchase cost.

Live diagnostics emitted counts, dates and reason categories only. No account identifiers, tickers, transaction values, credentials, screenshots or raw transaction archive were saved. Tests and browser checks use synthetic fixtures.

## Validation

Synthetic tests cover repeated and partial transfer chains, multiple accounts, ambiguous paths, missing legs/basis/fees, ending-share mismatches, uncertain same-day ordering, input immutability, verified closed snapshots, freshness/synchronization failures and account-specific evidence gaps. Validation passed: **366 unit tests**, **3 focused desktop browser checks**, lint, TypeScript, formatting and production build. Browser checks cover return-page accessibility, loading/empty/error/privacy states, and keyboard access to recovery instructions.
