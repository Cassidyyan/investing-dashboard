# Security and data behavior

[Start here](../README.md) · [Code and folder guide](project-guide.md)

This document describes the app's existing boundaries and calculations. For where files live and how to change them, use the project guide.

## Credentials and read-only access

- Keep SnapTrade Personal credentials in `.env.local`, entered directly in your editor. Never paste them into chat or commit them. `.env.example` contains empty variable names only.
- Run `git check-ignore .env.local` to confirm Git ignores the file. Avoid `NEXT_PUBLIC_SNAPTRADE*` variables; public variables can reach the browser.
- `src/server/snaptrade.ts` is the sole SDK initialization. Server modules use `import "server-only"`; UI and calculation modules must not import the SDK.
- The adapter exposes read-only account, balance, position, order, activity and history operations. ESLint prohibits trading and registration methods. Existing brokerage connections are reused.
- The app runs on localhost and has no remote login system. Balance hiding does not provide authentication.
- Raw brokerage responses are not deliberately logged or stored by the application. Current snapshots and normalized display data are available to the running app and browser.

Logo.dev is optional. Only its publishable `pk_` key belongs in generated image URLs; a secret `sk_` key is rejected. Ticker image requests expose the ticker and publishable key to the image service. Missing or failed logos show a ticker initial. SnapTrade credentials are never part of logo URLs.

## Partial failures and freshness

`load-portfolio.ts` fetches required sections concurrently and keeps successful results when another section fails. Missing data stays missing rather than becoming invented holdings or returns. Stale or incomplete snapshots retain their notices. Repeatedly refreshing can produce rate-limit responses; loading more UI panels or sorting loaded rows does not request brokerage data.

Header Updated time can mean retrieval time; cash accounts use a common valid account sync when available. When their sync times differ, individual cash rows retain those times. Neither timestamp guarantees a real-time market quote or independently verified cash freshness.

## Account classification

Investing and cash views reuse the existing loader scopes. Brokerage-identified DEPOSIT accounts and confirmed accounts with no open positions belong on Cash & chequing. Failed position requests and incomplete accounts are not automatically reclassified as empty. Cash-only investing accounts are not verified deposit accounts.

By user preference, cash-only investing accounts display **HYSA**, with a personal higher-than-chequing yield assumption explained in the tooltip. This does not change the reported brokerage type, invent an APY, or calculate interest earnings. DEPOSIT accounts display **Deposit / banking**.

Zero-CAD and zero-USD reported accounts remain hidden in current account views. Historical-return analysis uses the history scope, which retains zero-balance and cash-only investing accounts so previously sold holdings can still contribute.

## Values and currencies

Native CAD and USD amounts remain separate unless a view explicitly requests conversion. The latest daily Bank of Canada CAD-per-USD reference converts CAD to estimated USD by division. It is not a Wealthsimple execution quote; spreads and fees are excluded. Invalid or unavailable FX does not silently become a rate of 1.

Different totals use different scopes:

| View                              | Value scope                                                                                                                                     |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview reported portfolio       | Brokerage-reported investing account totals, converted to the selected currency                                                                 |
| Accounts reported total           | Original brokerage account-level value                                                                                                          |
| Accounts estimated total          | Available positions plus cash, retaining short-position values                                                                                  |
| Holdings estimated holdings value | Existing positive-position allocation scope, including valued options; excludes cash balances and zero, negative or unavailable position values |
| Industry allocation               | Eligible positive equities/funds; excludes options, crypto, cash equivalents and unsupported derivatives                                        |
| Cash summary                      | Native cash balances, not buying power or reported account total                                                                                |

Scope, missing data, FX and snapshot timing can make totals differ. Buying power is shown separately and never added to account value. Cash-equivalent handling in existing helpers prevents double counting where applicable. Shorts remain in the holdings list even when excluded from positive allocation. The exclusions popover lists actual excluded positions and reasons; unavailable account requests are disclosed separately.

Holdings account and currency filters affect summary and allocation. Search and the Holdings / Options tabs affect the list only; weights keep the full selected positive-position denominator. Funds retain app-maintained fund categories instead of looking through to their underlying holdings. Industry labels are maintained by the app, not official GICS classifications; unknown labels remain unclassified.

Cash and reported account totals are compared only when their nonzero cash amounts use the reported currency and both figures are available. Differences greater than roughly one cent are flagged; unlike currencies are not simply added and declared inconsistent. Values are not overwritten to make separate brokerage fields agree.

An actual reported **USD cash** zero renders as `0`. Missing cash, including USD cash, renders as Unavailable. Phase 1 intentionally removes the earlier missing-as-zero display preference so an absent source value cannot be mistaken for a reported zero.

## Hiding balances

`components/shared/BalancePrivacy.tsx` supplies the visibility context and `PrivateValue`. The root layout reads a boolean cookie so hidden amounts do not briefly appear on reload. Only the visibility preference is persisted, not financial figures.

Wrap new sensitive amounts and quantities in `PrivateValue`, or use shared `MoneyValue`. Holdings hides amounts with `••••`, blurs charts, and keeps percentages visible. Other views retain their existing privacy behavior. Names, tickers, dates and counts stay visible.

This is display privacy: data is still available in browser props and network payloads. It does not change calculations, stop fetching, or provide an access-control boundary. Component privacy tests check rendered amounts, including collapsed details.

## Positions and options

Normalization preserves existing price, cost, multiplier and valuation rules. Expanded rows display native quantities, last price, average cost and unrealized returns when available. Unrealized return is not lifetime profit; separate realized gains, dividends, fees, taxes and FX adjustments are excluded.

Option expiry and moneyness use the existing helpers. Calendar days are computed in America/Toronto, not as an exact trading cutoff. At the money means within 0.5% of strike. Moneyness describes the contract, not whether the position has made a profit. Underlying prices come from available position data; missing prices do not produce invented moneyness. Greeks and IV require an additional source and are not derived from position prices.

The Holdings load does not supply day change, so that column is omitted. Overview now connects available account history and recent activity. Unsupported data remains unavailable rather than manufacturing figures. Its daily value changes include cash flows, and the funding-based gain estimate is labelled separately from investment return.

## Historical account performance

Performance and Overview both reuse account value history through `load-performance.ts`. Overview uses `load-overview.ts` to compose that load with current snapshots and recent activity, without requesting legacy brokerage return rates. History and reported returns normalize independently, so one failing endpoint does not hide the other's successful response. Available history depends on the connected account and API capabilities; an activity-history permission does not establish that account value history is available.

The UI's existing daily history range is limited to its available source, with five-year history disabled. Range filters operate on loaded points. Currency aggregation uses shared dates without filling missing accounts or mixing native currencies. Daily value change includes cash flows and is not labelled investment return. Reported-return periods are matched exactly and never averaged across accounts.

### Return percentages at an inspected date

Performance and Overview conditionally read funding transactions for accounts with historical value points. It uses the existing read-only transaction adapter, fetching up to 10,000 available transactions per account with no date filter. Funding reads are sequential, skip accounts without charts, and stop after a rate limit. Incomplete pagination, missing IDs, repeated IDs and request failures make funding-based returns unavailable without removing the value line.

Cash CONTRIBUTION amounts increase net deposits; signed WITHDRAWAL amounts decrease them. Trades, dividends, interest, fees and taxes are investment activity, not external funding. Unknown transactions, transfers, in-kind contributions, unexpected signs, fee-bearing funding and foreign-currency funding need reconciliation rather than being guessed. Events after the inspected date never affect earlier metrics. An undated funding issue blocks the calculation because its timing cannot be established.

- **Gain vs net deposits** = `(value at the inspected date − cumulative net deposits through that date) / cumulative net deposits`. It requires positive net deposits and is not a time-weighted investment return.
- **Range return · cash-flow adjusted** uses Modified Dietz: `(ending value − starting value − net flows) / (starting value + time-weighted flows)`. The starting value is the first actual snapshot in the selected range. Flows after that snapshot through the inspected date are weighted by the fraction of calendar time remaining, assuming end-of-day flows. A deposit on the ending day has zero time weight; opening-day deposits are already in the opening snapshot. Positive weighted capital and a later inspected date are required.

These are non-annualized estimates based on available brokerage records, which may omit older funding. They are separate from brokerage-reported returns. No current FX rate is substituted for historical funding currency conversion. Grouped returns combine values and funding across the same currency/account scope instead of averaging account percentages. Range return may still be available when an older funding issue blocks the cumulative metric.

The original value line and its cash-flow-inclusive balance change remain unchanged. Net deposits respect balance privacy; Performance percentages remain visible by preference. Keyboard chart inspection exposes the same observations as pointer hover.

Sources: [SnapTrade account activities](https://docs.snaptrade.com/reference/Account%2520Information/AccountInformation_getAccountActivities) and the [GIPS Modified Dietz methodology](https://www.gipsstandards.org/standards/gips-standards-for-firms/gips-standards-handbook-for-firms/).

## Lifetime holding-return estimates

`load-holding-returns.ts` reads available transaction pages. `lib/returns/reconcile-transfers.ts` matches internal zero-cash share transfers only when a unique pair and ending share counts reconcile; recorded basis carries over without manufacturing a sale or second purchase. `lib/returns/holding-returns.ts` matches average-cost purchases and sales per account, then aggregates by security and native currency.

Profit includes realized plus unrealized gains/losses, reported dividends and separately attributed charges. The percentage denominator is cumulative purchase outflows, including repeat purchases. It is not annualized, time-weighted, IRR or tax reporting. The leaderboard supports eligible stocks/funds; options and shorts are excluded.

Negative-quantity sales are supported. Missing purchase history, unmatched transfers, corporate actions, uncertain trade ordering, nonzero trade fees and unavailable FX can require reconciliation. Tickerless transactions remain coverage warnings rather than blocking unrelated ranked holdings. “Lifetime” means the history available to the app, not verified all-time brokerage coverage.

Eligible cross-currency cash flows can use historical Bank of Canada daily rates, with explicit estimate notes. Current rates never substitute for unavailable historical observations. Individual holding-return lines still require a historical stock-price provider; their controls do not imply connected price history.

## Development previews and tests

Invented data lives exclusively in `src/dev/previews/` and test fixtures. Labelled `?preview=` states are enabled only by the existing development route branches. Production ignores those branches, and live failures never fall back to sample figures.

Tests run without brokerage credentials. They exercise partial failures, normalization, currency handling, history, allocation, transfers, privacy and page states. Moving files does not change API requests, calculations or read-only behavior.

All browser-check routes now use explicit synthetic previews, including Activity. Use `SCREENSHOTS_DATA_MODE=preview npm run screenshots` for synthetic-only captures; this fails a route when its preview is unavailable rather than falling back to live financial data. Preview routes remain development-only.

## Overview history scope

Overview's reported total still uses current reported investing balances and the selected daily reference conversion. Its history and statistics use observed native-currency snapshots, never current-rate conversions of past values. If the chosen current-total currency has no native history, the chart falls back to an available reported currency and explicitly labels it. Current total and history can therefore differ in date, account coverage, currency and scope.

Only current investing accounts are included in this history cohort; Cash & chequing stays out of investing totals/history. Successful histories with no usable snapshots and failed histories are excluded from the chart with coverage disclosure. Within each currency, aggregation requires shared dates for every included account. Future snapshots are ignored. The latest change uses the latest two available daily snapshots; a missing/zero baseline does not produce an invented percentage. Account-level changes retain their source currency for any separately labelled current reference conversion in the account list.

Overview also reads recent activities through the existing read-only activity method. The adapter sorts valid dated transactions across retrieved accounts and shows at most five, with original currencies. It discloses failed loads and omitted undated rows; recent activity is not an exhaustive lifetime ledger. No raw responses or historical records are persisted. These extra requests happen on page load or manual refresh, not on range or currency changes.

Account value history remains beta and may contain gaps or schema changes; see [SnapTrade's history documentation](https://docs.snaptrade.com/reference/Account%20Information/AccountInformation_getAccountBalanceHistory). Account history cannot replace individual stock-price history for the holding comparison chart, missing trade cost basis, or options Greeks/IV. Those unavailable states continue to name their actual missing source.

## Performance presentation and privacy

The redesigned Performance page reuses the existing loaders, native-currency aggregation, range cutoffs, value-change helper and funding calculations. The largest value is the latest observed snapshot in the chosen range, not a new live brokerage quote. Account rows use the same existing per-account histories and optional portfolio type metadata; missing metadata is omitted. The header distinguishes retrieval time from the last observed date.

Observed-day markers and dashed gaps do not supply missing daily prices. The Chart/Table switch and keyboard/touch inspection operate locally. Previous-observation changes can span several calendar days and remain labelled accordingly. High/low and summary figures are derived only from the selected observed series. Five-year history is hidden because the existing source does not supply it. Native USD tabs appear only when USD history exists; USD holdings within a CAD-reported history do not create an invented USD line.

Brokerage-reported returns retain exact supplied periods, percentages and dates; missing cells show a dash with an accessible explanation. If no supported periods exist, one empty state replaces repeated per-account warnings. Access guidance is conditional and does not enable features or change permissions.

Performance's balances-hidden state now masks monetary values and net deposits with **••••**, blurs charts and leaves percentages visible as requested. This overrides its earlier percentage-hiding presentation preference; the underlying display-privacy boundary remains unchanged. The obsolete slider/component was replaced with keyboard-operable chart inspection and an explicit Table view.

## Holding Returns display scope

The redesigned leaderboard changes presentation only. The original history account scope still includes sold securities and zero-balance investing accounts; transaction loading, average-cost profit calculations, transfer reconciliation, FX estimation and exclusion rules remain unchanged.

Summary profit, realized, unrealized and dividends aggregate only eligible ranked holdings in one native currency. Unranked reported dividends appear separately and are excluded from summary totals. Total profit retains attributed charges/refunds: the breakdown and expanded details show their signed impact, not an added source of return. The CAD/USD control switches native cohorts and applies no additional exchange-rate conversion.

The account control filters by account names associated with each combined holding row. It does not infer per-account profit allocations. A holding spanning two accounts can appear in either filter with the same combined result; those filtered totals must not be summed as separate account returns. The UI explains that scope. Search affects the ranked/unranked lists only, and table sorting happens before the ten-row display limit. Best and worst cards remain ordered by total profit regardless of the table's sort setting.

The estimates drawer retains the full lifetime, missing-history, tickerless-transaction, transfer and FX explanation. An amber coverage strip appears only for actual account issues or unranked holdings. Grouped reason labels are display categories derived from existing issues; the exact deduplicated reasons remain available in accessible popovers and no eligibility rule is relaxed.

Names for fully sold securities, per-account profit splits, and exact per-transaction FX observations are not exposed by the existing return rows. Missing names are omitted and available FX notes identify the estimation source. No single current FX rate is substituted for historical rates. The comparison view continues to state that a separate historical stock-price source is required.

Hidden amounts and share quantities render **••••**, profit bars blur, and percentages stay visible. Zero amounts display a dash when visible; missing and zero values retain distinct accessible labels. Holding identities and public rate methodology remain visible. Logo.dev attribution and initial-based fallback remain available. Native dialog behavior supplies modal focus trapping and Escape dismissal; closing returns focus to the opener.

## Request and refresh protection

`server/request-protection.ts` shares identical in-flight reads and limits concurrency to three, with at most 100 queued distinct reads, within the current Node.js process and credential scope. Keys and in-flight promises are removed after success or failure; completed responses are not cached. The adapter scopes protection using a credential digest held only in server memory. Changing credentials creates a separate scope.

HTTP 429 responses start a shared server cooldown using `Retry-After` seconds or HTTP date, with a minimum one second and a 30-second fallback. Queued requests check the cooldown before reaching the SDK. No automatic retry or disk persistence is introduced. This protects one running process; it does not coordinate multiple deployments.

Retry-After header names are case-insensitive. Malformed, negative, hexadecimal or noninteger numeric values use the fallback rather than producing an accidental immediate retry.

All manual page refresh/retry controls use a shared 30-second tab-local cooldown and remain disabled during an active refresh. This preference is not persisted and a full reload resets the client timer; server concurrency/deduplication and rate-limit cooldown remain independent. Financial calculations and read-only account scopes are unchanged.

## Presentation-only polish

Overview's optional per-account cash list projects the already-loaded native balance rows; existing totals, account scopes and conversions are unchanged. Activity is one local-filtered feed over the same recent order/activity requests, not newly fetched history. Show more reveals further loaded items only. The UI does not claim a complete thirty-day order history because the adapter supplies recent orders without a guaranteed coverage interval. Missing order amounts/prices, market data, Greeks/IV, historical holding comparison lines and unavailable returns remain missing.

All currency displays use the shared Money renderer. Hiding balances removes the monetary text, preserves the display footprint and leaves allocation percentages visible. It remains display privacy, not authentication. No additional financial persistence, data source or provider was introduced.

## Phase 1 source fidelity

New financial domain records retain validated decimal strings, source status/provenance and a whitelist of original scalar monetary fields in memory. No raw-response archive or storage implementation was added. Existing numeric UI models remain projections; they are not a precision-safe accounting ledger. Shared transaction-page validation rejects missing IDs, repeated records, cross-account records and inconsistent coverage rather than silently double counting or accepting incomplete history.

See [the audit](phase-1-audit.md) for exact formula changes and remaining floating-point limits, [options foundations](options-data-foundation.md) for conservative matching and unavailable fields, and [the storage proposal](historical-storage-plan.md) for decisions requiring future approval.
