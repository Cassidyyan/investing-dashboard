# Holdings — start here

This is your private investing dashboard. It reads your existing SnapTrade accounts and displays balances, positions, orders, and activity. It cannot place trades.

The app uses **Next.js** (the web framework), **React** (the screen components), and **TypeScript** (JavaScript with checks for the shapes of your data).

## Run the app

Open a terminal in this folder. Use Node.js 24 LTS and npm.

1. Install the packages the app needs:

   ```sh
   npm ci
   ```

2. If `.env.local` already exists, keep it. Otherwise, copy `.env.example` to a new file named `.env.local` in this folder. Enter your two SnapTrade Personal credentials directly in that local file. Keep `.env.example` empty so it is safe to share.

3. Confirm Git ignores your private file:

   ```sh
   git check-ignore .env.local
   ```

   This must print `.env.local`. Never paste credentials into chat or commit them to Git.

4. Start the development server:

   ```sh
   npm run dev
   ```

5. Open http://127.0.0.1:3000. Stop the server with **Ctrl+C** in the terminal. Restart it after changing `.env.local`.

Without credentials, you will see setup instructions. This app is meant to run on your own computer; it has no login system for remote access.

## Optional security logos

For ticker icons, get the **publishable** key (`pk_…`) from your [Logo.dev dashboard](https://www.logo.dev/dashboard). Add `LOGO_DEV_PUBLISHABLE_KEY=` to `.env.local` and enter its value directly in your editor, then restart the app. Do not use the secret `sk_` key. Do not replace your existing environment file or paste keys into chat.

The publishable logo key is designed to appear in image URLs and is visible in browser requests. SnapTrade credentials stay server-only. Without a valid publishable key, or when a logo cannot load, the table shows a ticker badge. Logos are optional and do not affect portfolio data. Logo.dev supports exchange suffixes, so Canadian listings keep `.TO`, `.NE`, and other ticker suffixes.

## Find your way around

```text
investing-dashboard/
├── README.md                 Start here
├── docs/                     Explanations for learning and maintenance
├── src/                      The application code you edit
│   ├── app/                  Pages, page layout, loading screen, and styles
│   ├── components/           Screen elements grouped by feature
│   │   ├── layout/           Page shell, navigation, and loading animation
│   │   ├── overview/         Summary cards
│   │   ├── performance/      Daily history charts and period controls
│   │   ├── returns/          Lifetime holding-return leaderboard
│   │   ├── accounts/         Investing account tables and totals
│   │   ├── cash/             Cash & chequing table
│   │   ├── holdings/         Position tables, sorting, and tabs
│   │   ├── options/          Option contract cards
│   │   ├── activity/         Orders and transactions
│   │   └── shared/           Cards, money display, badges, privacy, controls
│   ├── server/               Private code that reads SnapTrade data
│   ├── lib/                  Types, formatting, and helpers grouped by feature
│   ├── styles/               Shared dashboard design system
│   └── dev/previews/         Invented development-only sample data
├── tests/                    Checks grouped by the code they cover
│   ├── components/           Rendered UI checks
│   ├── server/               Fetching and normalization checks
│   ├── lib/                  Calculation checks mirroring src/lib features
│   └── helpers/              Test-only support files
├── .env.example              Shareable template; empty variable names only
├── .env.local                Your private credentials; ignored by Git
├── .gitignore                Rules for what stays out of Git
├── package.json              Commands and required packages
└── package-lock.json         Exact package versions; keep this in Git
```

There are a few configuration files at the top level because the development tools look for them there. You usually won't need to edit them. The [project guide](docs/project-guide.md) explains each one.

## Pages

- **Overview** (`/`): portfolio hero with CAD/USD switching, cash, account balances, allocation, top holdings, and an activity availability state.
- **Performance** (`/performance`): daily historical values with range controls and separate brokerage-reported returns. SnapTrade history is a beta add-on with a one-year limit; intraday and five-year histories are unavailable.
- **Accounts** (`/accounts`): combined estimated USD value at the top, a four-column reported-account view, expandable CAD/USD estimates and buying power, and teal account allocation. Below 768px, accounts become stacked cards. Accounts with a reported total of 0 CAD or 0 USD remain hidden.
- **Holdings & options** (`/holdings`): searchable, sortable positions with optional account grouping, expandable contract details, a currency-aware summary, and one Industry / Holding / Account allocation card. Mobile positions become stacked cards.
- **Activity** (`/activity`): recent orders and transactions, collapsed by account.

**Cash & chequing** (`/cash`) shows a native CAD/USD cash summary and account count, followed by a three-column account view that becomes stacked cards below 768px. It includes brokerage-identified banking accounts and accounts confirmed to have no open holdings. They stay out of investing pages and totals. Zero-CAD and zero-USD accounts remain hidden. Failed holdings requests and incomplete data remain visible.

Open a panel by clicking its heading. Expanding panels and switching position tabs do not make more API requests.

## Read the code in this order

1. [page.tsx](src/app/page.tsx): the overview page. It loads balances and shows summary cards and navigation links.
2. [AccountsTable.tsx](src/components/accounts/AccountsTable.tsx): a component that turns account data into a table.
3. [types.ts](src/lib/types.ts): definitions of the data the components expect.
4. [load-portfolio.ts](src/server/load-portfolio.ts): requests account data and keeps successful sections when another section fails.
5. [normalize.ts](src/server/normalize.ts): turns SnapTrade responses into simpler display data.
6. [snaptrade.ts](src/server/snaptrade.ts): connects to SnapTrade using credentials that stay on the server.

For a map of every source file, the data flow, and suggestions for first edits, see the [project guide](docs/project-guide.md).

## Everyday commands

| Command                | What it does                                              |
| ---------------------- | --------------------------------------------------------- |
| `npm run dev`          | Runs the app while you edit; saved changes appear locally |
| `npm test`             | Checks calculations and behavior when requests fail       |
| `npm run typecheck`    | Checks that code uses the expected data types             |
| `npm run lint`         | Checks coding rules, including the read-only restrictions |
| `npm run format`       | Makes indentation and spacing consistent                  |
| `npm run format:check` | Checks formatting without changing files                  |
| `npm run build`        | Checks that the app can be packaged for production        |
| `npm start`            | Runs the last production build on localhost               |

After a code change, run type checking, linting, and tests. Run a build before considering the app ready to use in production mode.

## Private files and generated folders

Edit `.env.local` only on your machine. Never put credentials in a `NEXT_PUBLIC_` variable: those variables can reach the browser. Existing brokerage connections are reused; no `userId` or `userSecret` is needed.

`node_modules/`, `.next/`, and `*.tsbuildinfo` are generated by the tools. They are ignored by Git and hidden in VS Code's Explorer to reduce clutter. You can change that display preference in [.vscode/settings.json](.vscode/settings.json). Their contents remain on disk.

Detailed currency rules, freshness behavior, security boundaries, and troubleshooting are in [Security and data behavior](docs/security-and-data.md). The integration follows the [SnapTrade Build with AI guide](https://docs.snaptrade.com/docs/build-with-ai.md).

## Holding returns

Open **Holding returns** for the lifetime leaderboard. It ranks by total profit by default, with an optional return-percentage ranking and separate CAD/USD views. Estimates include realized gains and losses, current unrealized profit, reported dividends, and separately attributed charges. Expand sale history to see profitable and losing sales.

The page requests all transaction history known to SnapTrade, including connected investing accounts whose current balance is zero. Missing purchase history, unmatched transfers, splits, reinvestments, uncertain trade ordering, nonzero trade fees, and unavailable historical FX still require reconciliation. Uniquely matched internal share transfers carry the original recorded cost without counting a sale or another purchase. CAD/USD cash flows can use historical Bank of Canada daily reference rates; affected figures are clearly labelled FX estimates, not exact brokerage returns. “Lifetime” means available history, not verified all-time brokerage coverage.

Brokerage sales with negative share quantities are supported. Transactions without a ticker appear as coverage warnings; ranked estimates cover matched records only, and missing older trades or dividends can still change them. The currency filter shows the number of ranked holdings in each currency.

**Compare return lines** previews the 1D, 5D, 1M, 3M, 6M, YTD, and 1 Year controls. Actual lines require a historical stock-price provider, which has not been configured. No demo data or fabricated history is shown. The planned axes are duration since first recorded purchase and return percentage.

## Overview design previews

In development (`npm run dev`), open `/?preview=sample`, `/?preview=loading`, `/?preview=refreshing`, `/?preview=empty`, `/?preview=error`, or `/?preview=hidden`. These routes use explicitly labelled, invented data from `src/dev/previews/overview-preview.ts`; they skip brokerage requests. Production ignores the preview parameter. The live overview never falls back to sample figures.

Overview now requests account history, available funding history and recent activity through the shared server loaders. The value chart, latest daily value changes, per-account changes, gain versus recorded net deposits and newest transactions use those live results. Failed sections retain their safe messages instead of falling back to sample data. `/?preview=history` demonstrates this connection using explicitly invented fixtures in development. Individual stock-return comparison lines still require a separate historical price provider.

## Accounts design previews

Development-only Accounts states are available at `/accounts?preview=sample`, `loading`, `refreshing`, `empty`, `error`, and `hidden` (use the same `?preview=` parameter for each). Invented fixtures live in `src/dev/previews/accounts-preview.ts`; previews do not query SnapTrade. Production ignores the preview parameter. Live fetching and account filters are unchanged.

## Cash design previews

Development-only cash states are available at `/cash?preview=sample`, `loading`, `refreshing`, `empty`, `error`, and `hidden` (use `?preview=` for each). Fixtures in `src/dev/previews/cash-preview.ts` are explicitly invented; the sample includes one deliberate cash-versus-reported difference to demonstrate the disclosure. They do not query the brokerage and are ignored in production.

The cash currency toggle selects the native CAD or USD subtotal, without conversion or any new exchange-rate request. Reported account totals stay separate and unchanged. Classification and comparison explanations are in keyboard-accessible popovers; accounts with different sync timestamps retain their individual times.

Cash-only investing accounts use your personal **HYSA** label, with an assumed higher yield than chequing explained in the tooltip. Brokerage classification, balances, and interest calculations are unchanged.

## Holdings page

The Holdings page uses the shared header, status, currency controls, cards and return badges. The Portfolio dropdown stays available; the secondary links connect Investing accounts, Cash & chequing and Holdings & options. Account and currency filters update the summary and allocation. Search and Holdings / Options tabs filter the list only; weights keep the full selected positive-position denominator.

The original positions request, valuation helpers and daily Bank of Canada conversion remain unchanged. **Estimated holdings value** follows the existing positive-position allocation scope, including valued options, without cash balances or negative/zero/unavailable values. Shorts remain visible in the list. The exclusions popover explains each omitted position. Industry allocation uses only eligible equities/funds, so its total can be lower. Overview uses brokerage-reported investing totals; Accounts also shows an estimate from cash plus positions. Those totals can differ because their scopes and snapshots differ. Account details retain the original **Reported total**.

Day change is not supplied by this page's existing load, so there is no day-change column. Greeks and IV still need a market-data provider; available contract and moneyness details are retained without invented values.

In development only, `/holdings?preview=sample` uses explicitly labelled invented fixtures without brokerage requests. Other preview states are `loading`, `refreshing`, `empty`, `error`, and `hidden`. Live pages never fall back to fixtures. Balances-hidden masks amounts and quantities with **••••**, blurs charts, and leaves percentages visible.

Unavailable USD cash is displayed as `0` by preference. This is formatting only: underlying missing values, incomplete-data indicators, and portfolio calculations remain unchanged. CAD amounts, buying power, and reported totals keep their existing behavior.

## Historical performance hover

Hover over the account-value line, or use the keyboard chart inspection, to inspect both **Gain vs net deposits** through that date and **Range return · cash-flow adjusted** from the first visible snapshot. The latter is a Modified Dietz estimate with end-of-day deposit/withdrawal timing. Changing the range changes its baseline; it does not discard earlier deposits from the cumulative metric.

The app now reads available funding history for accounts whose charts load. Missing/incomplete funding, unsupported transfers or unconverted funding currencies produce an unavailable explanation, never an invented percentage. The value line and brokerage-reported returns stay separate. Estimates depend on available history and can miss older deposits. See [calculation details](docs/security-and-data.md#return-percentages-at-an-inspected-date).

For local UI checks, `/performance?preview=sample` uses clearly labelled invented history/funding without calling SnapTrade. Production ignores this preview.

## Shared live history on Overview

`src/server/load-overview.ts` loads current snapshots and recent activity, then reuses the Performance history/funding loader once for investing accounts. It skips the legacy brokerage return-rate request because Overview's gain estimate comes from dated funding. Recent activity stays in each transaction's original currency.

Historical values stay in their reported currency. If the selected current-total currency has no history, the chart shows an available native currency with an explicit label; for example, a USD current total can sit above clearly labelled CAD history. Today’s Bank of Canada rate converts current totals, never past snapshots. Historical account coverage, as-of dates, gaps and funding limitations are shown in the coverage disclosure. The chart uses shared observed dates only. Empty/failed histories do not erase successful account histories; excluded accounts are reflected in the coverage count.

“Latest daily value change” includes funding flows and is not investment return. “Gain vs recorded net deposits” is an estimate from available funding, not verified lifetime profit. Unsupported transfers, missing historical funding or unconverted funding currencies can keep that metric unavailable even when the value chart works. Refresh repeats these read-only loads; there is no background polling or persisted financial history.

## Performance page design

Account performance uses the shared teal dashboard header/cards and shows **Data through** separately from retrieval time. Account selection and native CAD/USD tabs filter already-loaded histories; there is no combined or converted historical line. The shared range controls hide unsupported 5Y history. **Change in value** retains the existing calculation and includes funding flows; brokerage-reported returns remain a separate card.

Hover, touch, or focus the chart and use ← / → (Home / End also work) to inspect dates. A Chart/Table switch exposes the same observations and previous-observation changes. Dashed segments mark missing calendar days; no missing values are created. Single observations show a short message, and available per-account histories appear below the hero. Funding-based gain/Modified Dietz estimates remain available in the tooltip and disclosure.

Hidden balances render **••••** and blur charts while percentages remain visible. Loading, refresh, empty, reconnect and source-guidance states reuse the shared controls. Development-only examples: `/performance?preview=mixed`, `reported`, `single`, `empty`, `error`, `loading`, `refreshing`, and `hidden` (use `?preview=` for each). All preview figures are invented. Live fetching and calculations are unchanged.

## Holding Returns page design

The lifetime leaderboard uses the shared dashboard header, currency and range controls, cards and gain/loss badges. One coverage strip replaces the old warning banners; **Details** opens a keyboard-accessible estimates drawer containing methodology, account coverage warnings and the historical Bank of Canada rate explanation.

Summary tiles and best/worst cards use ranked holdings in the selected native currency and account association. Charges are retained in total profit and shown as a separate negative component when present; refunds have the opposite impact. Unranked holdings and their dividends do not enter these summary totals. Search filters the lists, while sort works across the full matching set before the first ten are displayed. Expand a row for account names, available first-buy dates, sales and calculation notes. The needs-data card groups existing issues into reason filters without changing eligibility.

Account association is a membership filter: each holding's original combined results remain intact. The data layer does not supply per-account profit splits, so these filtered totals must not be added together as independent account returns. Company names appear only when supplied by existing positions; names for sold holdings can be missing. Exact per-transaction FX rates are not exposed in the return rows; the available historical FX source notes are shown instead of a fabricated single rate. Compare return lines still requires historical stock prices.

Profit totals differ from account values on Overview/Portfolio and current positive-position values on Holdings: lifetime profit includes eligible recorded sales, unrealized gains/losses, dividends and attributed charges. They have different coverage and units of meaning. No calculation, FX rule, account scope or live API call was changed for this redesign.

Development-only Holding Returns previews: `/returns?preview=sample`, `complete`, `unranked`, `empty`, `loading`, `refreshing`, `error` and `hidden` (use `?preview=` for each). These figures are invented; production ignores them. Hidden amounts use **••••**, bars blur, and percentages stay visible. Logos retain their optional Logo.dev fallback and attribution.
