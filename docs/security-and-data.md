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

By explicit display preference, zero or unavailable **USD cash** renders as `0`. The underlying null value, calculation behavior and incomplete-data notices remain unchanged. Unavailable CAD cash, buying power and reported totals retain their existing formatting.

## Hiding balances

`components/shared/BalancePrivacy.tsx` supplies the visibility context and `PrivateValue`. The root layout reads a boolean cookie so hidden amounts do not briefly appear on reload. Only the visibility preference is persisted, not financial figures.

Wrap new sensitive amounts and quantities in `PrivateValue`, or use shared `MoneyValue`. Holdings hides amounts with `••••`, blurs charts, and keeps percentages visible. Other views retain their existing privacy behavior. Names, tickers, dates and counts stay visible.

This is display privacy: data is still available in browser props and network payloads. It does not change calculations, stop fetching, or provide an access-control boundary. Component privacy tests check rendered amounts, including collapsed details.

## Positions and options

Normalization preserves existing price, cost, multiplier and valuation rules. Expanded rows display native quantities, last price, average cost and unrealized returns when available. Unrealized return is not lifetime profit; separate realized gains, dividends, fees, taxes and FX adjustments are excluded.

Option expiry and moneyness use the existing helpers. Calendar days are computed in America/Toronto, not as an exact trading cutoff. At the money means within 0.5% of strike. Moneyness describes the contract, not whether the position has made a profit. Underlying prices come from available position data; missing prices do not produce invented moneyness. Greeks and IV require an additional source and are not derived from position prices.

The Holdings load does not supply day change, so that column is omitted. Live Overview likewise leaves unavailable history, day changes, lifetime returns and activity slots unavailable rather than manufacturing figures.

## Historical account performance

Only the Performance route requests account value history through `load-performance.ts`. History and reported returns normalize independently, so one failing endpoint does not hide the other's successful response. Available history depends on the connected account and API capabilities; an activity-history permission does not establish that account value history is available.

The UI's existing daily history range is limited to its available source, with five-year history disabled. Range filters operate on loaded points. Currency aggregation uses shared dates without filling missing accounts or mixing native currencies. Daily value change includes cash flows and is not labelled investment return. Reported-return periods are matched exactly and never averaged across accounts.

## Lifetime holding-return estimates

`load-holding-returns.ts` reads available transaction pages. `lib/returns/reconcile-transfers.ts` matches internal zero-cash share transfers only when a unique pair and ending share counts reconcile; recorded basis carries over without manufacturing a sale or second purchase. `lib/returns/holding-returns.ts` matches average-cost purchases and sales per account, then aggregates by security and native currency.

Profit includes realized plus unrealized gains/losses, reported dividends and separately attributed charges. The percentage denominator is cumulative purchase outflows, including repeat purchases. It is not annualized, time-weighted, IRR or tax reporting. The leaderboard supports eligible stocks/funds; options and shorts are excluded.

Negative-quantity sales are supported. Missing purchase history, unmatched transfers, corporate actions, uncertain trade ordering, nonzero trade fees and unavailable FX can require reconciliation. Tickerless transactions remain coverage warnings rather than blocking unrelated ranked holdings. “Lifetime” means the history available to the app, not verified all-time brokerage coverage.

Eligible cross-currency cash flows can use historical Bank of Canada daily rates, with explicit estimate notes. Current rates never substitute for unavailable historical observations. Individual holding-return lines still require a historical stock-price provider; their controls do not imply connected price history.

## Development previews and tests

Invented data lives exclusively in `src/dev/previews/` and test fixtures. Labelled `?preview=` states are enabled only by the existing development route branches. Production ignores those branches, and live failures never fall back to sample figures.

Tests run without brokerage credentials. They exercise partial failures, normalization, currency handling, history, allocation, transfers, privacy and page states. Moving files does not change API requests, calculations or read-only behavior.
