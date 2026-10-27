# Security and data behavior

[← Start here](../README.md) · [Project guide](project-guide.md)

## Data and behavior

The dashboard lists accounts, balances and buying power, unified positions, account allocation, recent orders, activity, and connection status. All SDK calls run on the server. Every page checks positions to identify accounts with no open holdings, then requests its additional detail sections. The overview loads balances; accounts loads balances and positions; holdings loads positions; activity loads orders and activities. Zero-CAD accounts are filtered before detail requests. Accounts with successfully retrieved positions containing no open holdings are excluded from investing pages, even if they hold cash, and are shown separately on Cash & chequing (`/cash`). Explicit `DEPOSIT` accounts also go on this page; `LOC` accounts are excluded from the cash page. Zero-CAD/USD accounts remain hidden. Cash-page accounts do not contribute to investing totals. Unknown position quantities, failed requests, and incomplete or stale account snapshots are retained. This intentionally excludes cash-only investing accounts too; it does not change or disconnect any brokerage account.

Each refresh retrieves the current page’s data again; it does not request a paid brokerage synchronization. Each request has a 20-second timeout. Independent sections load concurrently; errors remain visible while successful results survive.

Accounts with a reported total of exactly 0 CAD or 0 USD are hidden throughout the dashboard, including their positions, orders, and activity. They remain connected in SnapTrade. Accounts with unknown totals or totals in currencies other than CAD/USD remain visible. Summary counts and allocation reflect the visible accounts.

Totals are grouped by the API currency. Holdings charts and reported totals remain grouped by original currency. The Accounts page also offers the separate estimated conversion described below. Missing amounts stay unavailable, rather than becoming zero. Cash is shown separately from account value and is not added again to it. Allocation uses available non-negative account totals within each currency, excludes missing/negative totals, and can be incomplete.

Position values are estimates: units × price for supported stock/ADR/closed-end-fund/ETF/mutual-fund/crypto kinds, and units × price × reported multiplier for options. PHYS.TO in CAD is explicitly supported as a per-unit trust even when SnapTrade labels it `other`, based on the [issuer’s listing and unit information](https://sprott.com/media/xcilumow/phys.pdf). Other unrecognized instrument kinds or missing inputs produce unavailable values. Short positions preserve their signs. These estimates are not used to replace reported account totals.

Activity is a bounded first page (up to 25 matching records per account from the last 90 days), not a complete tax or performance record. Recent orders reflect the SDK endpoint's available window. Retrieval time is distinct from position `as_of` and brokerage holdings synchronization time. Holdings older than 36 hours are flagged; this threshold is a display heuristic, not a claim about the brokerage schedule. All displayed timestamps use America/Toronto.

## Holdings chart and tabs

The holdings allocation chart includes available positive position values from all visible accounts, including options, with a separate pie for each currency. Securities with the same symbol and kind are combined within a currency. Each pie shows the three largest holdings individually and combines the remaining holdings into an Other slice. A dropdown lists every remaining holding with its value and percentage of the full currency total. Cash balances are excluded. Missing, zero, negative, or unsupported position values are excluded and reported as incomplete allocation; zero-unit positions are omitted. This is a share of available positive position values, not net account value or risk exposure.

Current holdings excludes option and futures-option positions; Current options includes both kinds. Zero-unit positions are omitted from both tabs; unknown quantities remain visible. Short positions remain visible in the tables with their signs. Switching tabs makes no new API requests and does not resolve the existing API refresh rate limits.

## Accounts: native currencies and combined total

The Accounts page shows CAD and USD separately, estimated from reported cash plus supported position market values. Cash-equivalent positions are excluded because SnapTrade counts them in cash. Buying power is not added. Short positions and negative cash preserve their signs. The brokerage-reported account total remains a separate comparison; it is never added to the reconstructed values. Missing prices, unavailable sections, stale holdings, and incomplete accounts are flagged. Other currencies are excluded from the combined CAD/USD total and listed explicitly.

The bottom section sums visible accounts and estimates a USD equivalent using `USD + CAD / rate`, where `rate` is CAD per USD from Bank of Canada series `FXUSDCAD`. The server fetches the latest business-day observation from the public Valet API with no credentials or portfolio data sent to that service. The page displays both rate directions and the observation date. This is a daily reference rate, not a Wealthsimple execution quote; spreads and fees are excluded. Missing, invalid, or over-seven-day-old rates leave the combined total unavailable while preserving separate balances. There is no hardcoded or silent fallback rate. An unavailable rate request times out after eight seconds.

The overview’s reported account totals remain distinct from the Accounts page’s reconstructed estimates and can differ when broker data is incomplete or valuations use different timestamps.

## Security

- `.env.local` and other environment files are ignored; `.env.example` has empty names only.
- `src/server/*` imports `server-only`. The SDK is initialized only in `snaptrade.ts` and only six read methods are exposed.
- No registration, signing implementation, user secret, trading endpoint, database, persistent response cache, analytics, remote fonts, or telemetry integration is included.
- The dynamic page is excluded from static rendering. Responses use private/no-store headers; raw financial responses and upstream errors are not logged or sent to the browser.
- ESLint bans trading method names and `NEXT_PUBLIC_SNAPTRADE*` references in application code. These checks are guardrails, not a security sandbox for arbitrary future code.
- The Personal API key itself may have trading privileges; this application's read-only design does not change the key's permissions.
- Account identifiers are displayed as suffixes. Browser-rendered financial data is still sensitive.

## Checking live data

With local credentials configured, compare the accounts, currencies, balances, and holdings against your SnapTrade dashboard. Check that browser source/network responses contain neither credential. Check stale and disabled connections before interpreting discrepancies. Live brokerage correctness cannot be verified without your locally configured account access.

## Troubleshooting

- **Setup screen:** ensure both variables are populated in `.env.local` at the project root and restart Next.js. Do not prefix them with `NEXT_PUBLIC_`.
- **Unavailable section:** refresh after checking your network, Personal API key, API access, and brokerage connection. Errors intentionally omit upstream response bodies.
- **Disabled/incomplete connection:** repair it in the [SnapTrade dashboard](https://dashboard.snaptrade.com). The app does not mutate connections.
- **Old values:** some brokerages provide daily data; retrieval does not guarantee a fresh brokerage sync.
- **Unknown currency or unsupported instrument:** the app reports unavailable values rather than assuming USD or guessing valuation conventions.
- **Port in use:** stop the other server or use `npm run dev -- --port 3001`.

## Security logos

Position tables use Logo.dev’s ticker API, with cropped logo badges to the left of the ticker. Configure `LOGO_DEV_PUBLISHABLE_KEY` in `.env.local` using the `pk_` image key from the [Logo.dev dashboard](https://www.logo.dev/dashboard). The server rejects missing keys and secret `sk_` keys before constructing any browser-facing URL. The valid publishable key is included in image URLs and is intentionally visible in the browser; never use a SnapTrade credential here.

Next.js's image optimizer fetches from `img.logo.dev/ticker/` using only the ticker, publishable image key, and image settings. No brokerage account identifiers, balances, or quantities are sent. Logo.dev sees the requested tickers and the server’s image requests. Public logos may be cached by the image optimizer; financial API responses remain uncached. The request uses 64-pixel PNGs with retina rendering and `fallback=404`. Unavailable logos, unsupported option/crypto symbols, and missing configuration show a locally rendered ticker badge. No logo request is made to SnapTrade.

The image integration follows the [official ticker API](https://www.logo.dev/products/stock-ticker-logos). A small Logo.dev attribution link appears on the Holdings page.

## Average cost and net return in the position tables

Average cost uses the position endpoint's per-share/per-unit `cost_basis`, in the currency reported for price and cost. It is not the total cost of the position or a tax lot's total cost basis. The table labels net return as **unrealized**: `(last price − average cost) × signed units × instrument multiplier`. The percentage divides this value by the absolute entry cost of the current position. Short quantities reverse profit/loss direction; options use the reported multiplier. A zero entry cost has no defined percentage return. Missing/invalid costs, prices, quantities, currencies, or unsupported multipliers leave return unavailable. No additional API requests are needed.

This calculation measures price gain/loss on current open positions, not lifetime total return or tax gain. It does not separately adjust for dividends, realized gains, fees, taxes, or FX changes. Broker-reported average costs may already include adjustments. Check them against your brokerage if values differ.

## Options data availability

The option position response supplies contract metadata, not current Greeks or IV. The Current options panel displays call/put, underlying ticker, strike, expiration, calendar days remaining, signed quantity, multiplier, per-unit premium/cost, market value, and unrealized return where available. Futures-option metadata is displayed when supplied, but its existing unsupported valuation remains unavailable.

Moneyness uses the latest available held underlying position with matching instrument ID (or exact symbol/kind if no ID), currency, and a recent snapshot from a non-stale, complete account. No external underlying quote is fetched. Missing, stale, or mismatched data yields unavailable; a price snapshot can still be delayed. Calls are ITM above strike and puts below strike; ATM is defined here as within 0.5% of strike. This classification does not depend on whether the position is long or short and is not the position's gain/loss. Expired contracts are labelled expired rather than suggesting exercise status.

Greeks and IV remain unavailable by the user's choice to proceed without another provider. SnapTrade's [retired option quote endpoint](https://docs.snaptrade.com/reference/Trading/Trading_getUserAccountOptionQuotes) returns 410 Gone after October 1, 2026. No replacement data, guessed IV, or model-derived Greeks are substituted. No new credentials, request signing, or trading calls were introduced.

## Aggregated industry allocation

This view uses one common currency (USD), converting CAD position values with the existing Bank of Canada reference-rate loader. It combines included positive stock/fund values across visible investing accounts. It is not net portfolio value or delta-adjusted risk: options, cash, crypto, shorts, unsupported currencies, and unavailable valuations are excluded. Failures and stale data remain flagged, and a missing rate prevents a mixed-currency chart rather than silently dropping CAD holdings.

Industry groups are simplified, app-maintained classifications based on issuer descriptions, not a licensed GICS taxonomy or a live external classification feed. The mapping includes issuer-source URLs and a review date. Symbols retain exchange suffixes. Unclassified stocks remain in an Unclassified slice. Fund, sector-fund, and precious-metals-trust groups are distinct from operating-company industries, with no claim to ETF look-through allocation or overlap adjustment. Holdings and classification sources can be expanded under the chart. The chart shows the top three groups plus an Other slice, with remaining groups listed in a bounded scrollable dropdown.
