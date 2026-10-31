# Options Analytics MVP

Open **Options Analytics** in the shared navigation, or visit `/options-analytics`. It uses the existing read-only SnapTrade adapter, account-history scope, validated transaction pagination and request protection. No order/trading operation, database, paid provider, background polling or historical-Greeks source was added.

## CSV-first history and uploads

The **Import Wealthsimple activity** card accepts drag-and-drop or file selection. Uploaded activity exports replace the historical ledger in the current page's memory; full reload clears them and **Remove uploaded CSV** restores the original source. Local `private-data/wealthsimple/` exports remain supported on initial load. Both paths use CSV as the entire primary historical source and never append API fills. SnapTrade history is requested only when there are no CSV options. Current brokerage positions remain a separate snapshot; CSV aliases are not automatically mapped to them. Missing cash/fees remain unavailable, including expiry settlement fields previously supplied by API counterparts. See [private import instructions](private-imports.md) for limits, privacy and supported fields.

## Follow the data

```text
app/options-analytics/page.tsx
  → server/load-options-analytics.ts
    → existing account/position loader
    → csv-options-source when CSV exists, otherwise transactionRecords + normalizeTransaction
    → lib/options/ledger.ts + execution-cash.ts
  → components/options-analytics/OptionsAnalyticsDashboard.tsx
    → lib/options/analytics.ts applies local filters and aggregates
    → summary, charts, underlying table, journal and coverage
```

The ledger and metrics are pure helpers. UI components do not manufacture cash flows. The upload component sends only selected files to the stateless import endpoint; it does not fetch brokerage data. The page fetches current positions. When CSV options exist, their independently built ledger supplies history; otherwise it fetches full available activities for investing accounts, including zero-balance accounts, so sold contracts can contribute. Orders are cumulative snapshots and are never counted as executions. Reads are sequential by history page/account; after a 429, subsequent histories are skipped. Failed history coverage blocks that account's performance without removing successful other accounts.

## What is eligible

Trades require account-scoped transaction identity, a consistent contract key, an explicit action or documented CSV-side classification, usable dates and matched quantities. The Phase 1 matcher separates accounts, contracts and long/short direction. FIFO quantity edges support multiple fills and partial closes. Continuous exposure from opening to flat is one lifecycle; reopening after flat starts another. Different roll legs remain separate, with source references retained but no inferred strategy.

Cash accounting requires reported cash and explicit nonnegative fees. Missing fee is not zero. New installations retain reported option currencies by default; missing currencies remain unavailable. Explicit `HOLDINGS_OPTIONS_CURRENCY=USD` enables the prior USD-only personal assumption, without converting amounts. Original currency remains in source metadata, and no amounts are FX-converted. There are three evidence paths:

1. **Reported fee is exactly zero:** the signed source cash amount has the same gross/net meaning either way. It can support cash-based P&L without guessing a multiplier or deriving a missing execution price. Average entry/exit prices remain unavailable if source prices are missing. A contradictory available price/multiplier blocks the record.
2. **Reported fee is nonzero:** source price × quantity × an explicit confirmed multiplier must exactly reconcile either to the reported signed gross cash or to gross cash less fee. Deduct the fee once when the amount is gross; retain already-net cash otherwise. If neither convention reconciles, the trade needs review. No tolerance or implicit fee/multiplier assumption is inserted.
3. **CSV explicitly reports net cash and commission:** use the reported net amount and calculate gross premium as net plus commission, without guessing a multiplier or deducting fees again. See [CSV source precedence and fee exclusions](csv-reconciliation.md).

Historical activity symbols often lack an explicit multiplier. This MVP does not default to 100, infer a multiplier from cash, or backfill a historical deliverable from today's position. Nonzero-fee historical trades can therefore remain unavailable even when the journal knows their actions and quantities. That limitation is intentional. The [activity reference](https://docs.snaptrade.com/reference/Account%20Information/AccountInformation_getAccountActivities) documents signed amounts, per-share option prices and optional fee fields; source amount conventions still need record-level reconciliation.

Related fee/tax/adjustment records block affected contract accounting until allocation is verified; an unallocated fee can conservatively block an API-based account. CSV-based trade figures disclose excluded unallocated account fees separately. Separate fee records are not silently added on top of execution fees. Conflicting IDs, missing openings, ambiguous same-day ordering, incomplete pages and unresolved lifecycle events are excluded with reasons. Currency-tag differences are superseded only in option valuation/accounting by the USD assumption; raw cross-source identity matching is unchanged. Exact duplicate activities are ignored, including before expiration exposure tracking.

## Realization and outcomes

- Matched net opening cash + matched net closing cash = realized P&L for that quantity. Source fees are included once.
- Each execution's net cash and fee are allocated proportionally across quantity links using exact decimal arithmetic and explicit 12-place division. The final slice receives the residual, preserving the execution's total exactly, including quantities still open.
- A supported partial close realizes only its matched portion, on the closing activity's actual date. Remaining short premium is not profit. A partially closed lifecycle has no final win/loss classification.
- A completed lifecycle's total net realized P&L determines win, loss or breakeven. Win rate = winning completed lifecycles / all completed classifiable lifecycles, **including breakeven in the denominator**.
- Profit factor = gross completed winning profit / absolute completed losing profit. Positive profit with no losses is explicitly infinite; no wins and no losses is undefined. Best/worst cards select positive winning and negative losing lifecycles; absent categories stay unavailable.
- Expiration closes require an explicit expiration event, nonzero quantity, known expiry, dated event on/after expiry, reported zero settlement, explicit zero fee, native currency and one unambiguous known exposure direction. Absence of an event is never evidence of worthless expiration.
- Assignments/exercises remain in the journal as unresolved source events. No closing premium, assigned-share cost basis or realized profit is fabricated. Missing event fields also remain unresolved.

Available activity coverage is not a verified lifetime statement. Blocking account/contract issues can conservatively exclude otherwise plausible trades. Excluded monetary values never become zero or winners.

## Filters and charts

Account, underlying, put/call, lifecycle status and date controls operate locally. **All options are assumed to be USD**, per the explicit user policy in `lib/options/currency.ts`; there is no currency selector. Values are not converted or multiplied by an FX rate. This applies to option positions, strikes, activity display, CSV preview and option accounting. Original reported transaction currency remains available in source metadata; raw source records and cross-source identity matching remain unmodified. Non-option stock/cash currencies keep their original behavior.

The date range has explicit meanings:

| Display                                                                | Date used                                                                                                                            |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Realized total, daily/monthly realized chart                           | Closing/realization date for each matched quantity                                                                                   |
| Completed count, win rate, average win/loss, profit factor, best/worst | Final lifecycle close date; these statistics use the entire completed lifecycle's result                                             |
| Premium cash charts                                                    | Actual premium execution date, including still-open exposure                                                                         |
| Journal                                                                | Lifecycle close/realization or observed activity in the range; opening details remain available                                      |
| Current positions                                                      | Current snapshot, filtered by account/ticker/currency/put-call; historical date and lifecycle status do not alter a current position |

Because a lifecycle may partially realize before its final close, completed-lifecycle statistics can cover different amounts than the range's realization total. The UI discloses both scopes. Cumulative P&L sums only selected realizations, starting at zero for that range. It does not interpolate daily returns or fill missing observations. Monthly charts show partial realized cash as well as separate final-close counts/win rates. The chart supports hover/touch inspection, a keyboard-accessible observation selector and a text data alternative.

**Gross premiums collected** includes actual opening short credits and closing long credits, separately shown. **Net premium cash flow** is gross premium credits minus gross premium debits, before fees. It includes open trades and is never labelled realized P&L. Premium totals cover evaluable executions only, with missing-cash counts disclosed; they need not equal realized-profit coverage.

## UI, privacy and synthetic review

The page reuses WorkspaceHeader, navigation, StatusChip, CurrencyToggle, StatCard, Money, Select, InfoPopover, balance privacy and protected refresh. It has responsive tables/cards, empty/error/loading states, local journal search/sorting and progressive display. Expanding a trade shows contract terms, reported prices, matching quantities, source fee convention, cash evidence, recognized portions and exclusion reasons.

Hide balances masks monetary values and quantities, including chart inspection and expanded execution evidence. Financial charts are removed from rendered geometry while hidden; textual alternatives use the same masking. Percentages, counts and ratios remain visible. This is display privacy, not authentication.

Development-only synthetic states skip brokerage reads:

```text
/options-analytics?preview=sample
/options-analytics?preview=loading
/options-analytics?preview=empty
/options-analytics?preview=error
/options-analytics?preview=hidden
```

Production ignores previews. Live errors never fall back to invented data. To capture synthetic views at all three widths:

```sh
SCREENSHOTS_DATA_MODE=preview SCREENSHOTS_REVIEW_ROUTES=/options-analytics npm run screenshots
```

## Validation and remaining work

Tests cover long/short wins/losses, multiple fills, partial closes, repeat contracts, expiry evidence, assignment/exercise exclusions, rolls, duplicates, missing fees/openings/prices/multipliers, native currencies, gross/net fee reconciliation, related charges, dates, exact allocation, source provenance and rate-limit/partial-failure loading. Component/browser checks cover privacy, charts, filtering, disclosures and responsive accessibility.

Executed validation: 324 unit tests across 41 files and 60 browser checks passed. Lint, TypeScript, formatting and production build passed. Three strictly synthetic desktop/tablet/mobile screenshots were captured with zero failures in `screenshots/2026-10-31T05-22-29-076Z/`; screenshot outputs remain git-ignored. QA caught and fixed tablet navigation overflow, accessibility naming/focus issues, and inherited no-wrap styling in expanded journal details. Calendar-time chart spacing has a regression test. No live account totals were compared with brokerage statements.

Current product priority is **desktop**. Preserve existing responsive behavior, but defer further mobile-specific polish until requested. Mobile checks already completed above are regression evidence, not an expanded mobile development scope.

### Desktop completion status

Phase 2's desktop MVP is complete. Final desktop verification passed **23 browser checks**, including three dedicated completion checks in `tests/browser/options-desktop.pw.mjs`: actual chart hover amounts/dates and masking; native-currency, contract and date filters; and journal sorting with incomplete P&L kept unavailable and sorted last. The final unit suite still passes **324 tests**, with lint, TypeScript and formatting checks passing. The application source had already passed the production build.

The delivered scope includes navigation, KPI definitions, daily/monthly realized and premium charts, win/loss/breakeven statistics, underlying ranking, shared filters, the expandable execution journal, current positions, and coverage/error/loading/privacy states. Source-dependent exclusions described above remain visible. Historical-data recovery is a subsequent task; completing the MVP does not establish that the brokerage supplied a complete lifetime record.

Entry Greeks, delta cohorts, collateral/strategy returns, spreads, wheel classification, notes and durable history remain Phase 3/later work. Verify fee and assignment settlement semantics before extending eligibility. A legitimate entry-Greeks capture plan remains an earlier roadmap decision because missed observations may be unrecoverable; no provider or persistence was introduced here.

## Historical recovery update

The subsequent [history audit](history-recovery-audit.md) removes the former 10,000-record ceiling, adds complete/partial API coverage and 60-second in-memory reuse with explicit read timestamps, and separates transaction synchronization from holdings synchronization. The actual source contains multiple years of records but omits explicit open/close direction on historical option buys/sells; those remain unresolved. The original Phase 2 implementation/validation counts above are historical records of that phase.
