# Understanding the project

[← Start here](../README.md) · [Security and data behavior](security-and-data.md)

This project has four main parts: **pages**, **screen components**, **server code**, and **shared helpers**. Start with a page and follow its imports to understand one feature at a time.

## Folder map

```text
src/
├── app/                         Which page the visitor opens
│   ├── page.tsx                 / — Overview
│   ├── accounts/page.tsx        /accounts — Investing accounts
│   ├── cash/page.tsx            /cash — Cash & chequing
│   ├── holdings/page.tsx        /holdings — Holdings & options
│   ├── activity/page.tsx        /activity — Orders & transactions
│   ├── layout.tsx               Shared fonts and navigation-animation provider
│   ├── loading.tsx              Loading screen
│   ├── error.tsx                Retry screen
│   └── globals.css              App-wide styles, grouped into commented sections
├── components/                  Screen elements, grouped by purpose
│   ├── layout/                  Page shell, navigation, and loading animation
│   ├── overview/                Summary cards
│   ├── accounts/                Investing account tables, totals, and allocation bars
│   ├── cash/                    Cash/chequing account table
│   ├── holdings/                Position tables, sorting, and tabs
│   ├── options/                 Expandable option contract details
│   ├── activity/                Orders and account activity lists
│   ├── charts/                  Allocation charts and their shared SVG renderer
│   └── shared/                  Empty/error states and security icons
├── server/                      Private data access; every file uses server-only
└── lib/                         Shared types, formatting, and calculations

tests/
├── components/                  Rendered chart and summary checks
├── server/                      Normalization, fetching, and logo configuration checks
├── lib/                         Financial calculations, dates, and sorting checks
└── helpers/                     Test-only server-only marker replacement
```

`app/` follows Next.js naming rules: a folder containing `page.tsx` becomes a URL. The component folders follow the app's features instead of putting every screen element in one long list.

The `@/` prefix in imports means **start inside `src/`**. For example, `@/components/accounts/AccountsTable` points to `src/components/accounts/AccountsTable.tsx`. Imports use these direct paths so you can find a file without following re-export files.

## A good reading order

1. Open [the Accounts page](../src/app/accounts/page.tsx). It loads data, then chooses the screen components.
2. Open [AccountsTable](../src/components/accounts/AccountsTable.tsx). It receives account data and turns it into table rows.
3. Open [the shared types](../src/lib/types.ts). These describe the data each component expects.
4. Open [load-portfolio](../src/server/load-portfolio.ts). It requests accounts and their details, handles failures, and selects investing or cash accounts.
5. Open [normalize](../src/server/normalize.ts). It converts the API's response into those simpler display types.
6. Open [snaptrade](../src/server/snaptrade.ts). It creates the private API connection using local credentials.

## How data reaches the screen

```text
You open /accounts
  → app/accounts/page.tsx calls loadPortfolio()
    → server/load-portfolio.ts requests the required sections
      → server/snaptrade.ts makes read-only API calls
    → server/normalize.ts converts responses into display objects
  → components/accounts/AccountsDashboard.tsx supplies navigation, refresh, and warning states
  → components/accounts/AccountsTable.tsx displays the rows
```

The **server** is the local Node.js process started by `npm run dev`. The **browser** is where you view the page. SnapTrade credentials stay on the server. Components receive only the display data they need.

## Find the right component

Paths below are relative to `src/components/`.

| Folder      | Files and responsibilities                                                                                                                                                                                                                                                                                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layout/`   | `PortfolioPage.tsx`: shared page heading, navigation, setup/error states. `NavigationProgress.tsx`: starts and ends page-change feedback. `StonkLoader.tsx`: decorative SVG animation.                                                                                                                                                                                       |
| `overview/` | `OverviewDashboard.tsx`: page composition and refresh. `PortfolioHero.tsx`: value, currency, and chart. `AccountList.tsx`, `AllocationDonut.tsx`, `TopHoldings.tsx`, and `OverviewActivityList.tsx`: content cards. `Overview.module.css`: scoped design tokens and layout.                                                                                                  |
| `accounts/` | `AccountsDashboard.tsx`: Accounts page composition and refresh. `AccountsTable.tsx`: four-column accounts and mobile cards with expandable estimates/buying power. `CurrencyTotal.tsx`: top combined estimate and rate popover. `AllocationBar.tsx`: teal allocation based on reported totals. `ConnectionStatus.tsx`: retained optional component, currently not displayed. |
| `cash/`     | `CashDashboard.tsx`: page states and refresh. `CashSummary.tsx`: native cash totals and currency selection. `CashAccountsTable.tsx`: banking/cash-only account identities and reported figures, with mobile cards.                                                                                                                                                           |
| `holdings/` | `PositionsTable.tsx`: server-rendered account groups. `SortableHoldingsTable.tsx`: local column sorting. `PositionsTabs.tsx`: switches between holdings and options.                                                                                                                                                                                                         |
| `options/`  | `OptionsDetails.tsx`: contract cards, expiry information, premiums, return, and available moneyness.                                                                                                                                                                                                                                                                         |
| `activity/` | `OrdersList.tsx`: recent orders. `ActivityList.tsx`: recent transactions and activity.                                                                                                                                                                                                                                                                                       |
| `charts/`   | `HoldingsPieChart.tsx`: allocation by security/currency. `IndustryPieChart.tsx`: combined industry allocation. `AllocationPie.tsx`: shared smooth SVG pie renderer.                                                                                                                                                                                                          |
| `shared/`   | `SectionState.tsx`: empty/error states and warning notices. `SecurityIcon.tsx`: Logo.dev image with a ticker-badge fallback.                                                                                                                                                                                                                                                 |

The components render data rather than fetching brokerage data. Most render on the server. Files beginning with `"use client"` handle browser interactions, such as tabs, sorting, image fallback, or navigation feedback. Expanding an account and switching/sorting loaded rows do not request more brokerage data.

The shared navigation lives in `components/layout/DashboardNavigation.tsx`, with its own `DashboardNavigation.module.css` for dropdown and mobile styles. Four main controls group the pages: Overview; Portfolio (investing accounts, cash/chequing, holdings/options); Performance (account history and holding returns); and Activity. `lib/navigation.ts` supplies the shared destinations. Other detailed pages use `PortfolioPage.tsx`; Accounts uses `AccountsDashboard.tsx` and Overview uses `OverviewDashboard.tsx` for its distinct header, status area, refresh control, and 12-column card layout. Its CSS module contains the surface, border, text, brand, positive, negative, neutral, and chart color tokens.

## Server files

| File                       | Responsibility                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `server/snaptrade.ts`      | The only place the SnapTrade SDK is initialized; exposes read-only account and history operations.         |
| `server/load-portfolio.ts` | Concurrent fetching, partial failures, and account selection. Scope is `investing`, `cash`, or `overview`. |
| `server/normalize.ts`      | Masks account numbers, preserves currencies, and prepares positions, costs, returns, orders, and activity. |
| `server/exchange-rate.ts`  | Validates the latest public Bank of Canada daily CAD-per-USD rate.                                         |
| `server/security-logo.ts`  | Builds Logo.dev image URLs from a publishable `pk_` key; rejects secret keys.                              |

`import "server-only"` prevents these files from being imported into browser code. Never move credentials into a component or shared helper.

## Shared types and helpers

Paths below are relative to `src/lib/`. This folder stays small and flat so the shared calculations are easy to find.

| File                     | Responsibility                                                                                           |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| `types.ts`               | Display types, including `Money`, `PositionView`, `AccountData`, and `Result<T>`.                        |
| `format.ts`              | Currency, quantity, date, and signed-return formatting.                                                  |
| `currency-totals.ts`     | Separate native CAD/USD estimates and combined USD totals; avoids counting cash equivalents twice.       |
| `holdings.ts`            | Positive holdings allocation by currency and option-kind recognition.                                    |
| `industry-allocation.ts` | Combines positive stock/fund values into industry groups in USD.                                         |
| `security-industries.ts` | Editable industry classifications, issuer sources, and review date. Unknown tickers remain unclassified. |
| `option-details.ts`      | Calendar days to expiry, matching underlying position prices, and moneyness.                             |
| `sort-positions.ts`      | Numeric, stable sorting with unavailable values always last.                                             |

Financial assumptions, exclusions, stale-data rules, average-cost calculations, and provider limitations are described in [Security and data behavior](security-and-data.md).

## Where to make a change

| If you want to…                                          | Start with…                                                                 |
| -------------------------------------------------------- | --------------------------------------------------------------------------- |
| Change the overview layout or cards                      | `src/components/overview/OverviewDashboard.tsx`                             |
| Change the navigation order                              | `src/lib/navigation.ts` and `src/components/layout/DashboardNavigation.tsx` |
| Change colors, spacing, table density, or mobile styling | `src/app/globals.css`                                                       |
| Change fonts                                             | `src/app/layout.tsx`, then the typography sections in `globals.css`         |
| Change the investing account table                       | `src/components/accounts/AccountsTable.tsx`                                 |
| Change the cash account table                            | `src/components/cash/CashAccountsTable.tsx`                                 |
| Change holdings columns or sort buttons                  | `src/components/holdings/SortableHoldingsTable.tsx`                         |
| Change option cards or moneyness badge styling           | `src/components/options/OptionsDetails.tsx`, then `globals.css`             |
| Change a stock's industry group                          | `src/lib/security-industries.ts`                                            |
| Understand a missing balance                             | `src/server/load-portfolio.ts`, then `normalize.ts` and the relevant tests  |

## Tests

Tests use invented examples, never your live account. The running dashboard does not use those examples as fallback data.

- `tests/server/`: normalization, partial failures, account scopes, and publishable logo-key validation.
- `tests/lib/`: currencies, cash-equivalent handling, option dates/moneyness, security and industry allocation, and numeric sorting.
- `tests/components/`: SVG rendering and overview cash totals.
- `tests/helpers/server-only.ts`: a test-only replacement that allows testing server functions outside Next.js. `vitest.config.ts` applies it only during tests.

Run `npm test` to run the full suite. After changing imports or moving files, also run `npm run typecheck` and `npm run build`.

## Configuration and generated files

Keep framework configuration at the project root, where the tools expect it.

| File or folder                             | Why it exists                                                         |
| ------------------------------------------ | --------------------------------------------------------------------- |
| `package.json`                             | App commands and required packages.                                   |
| `package-lock.json`                        | Exact dependency versions; maintained by npm and committed to Git.    |
| `next.config.ts`                           | Next.js settings, allowed image source, and private-response headers. |
| `tsconfig.json`                            | TypeScript checks and the `@/` import shortcut.                       |
| `eslint.config.mjs`                        | Coding rules, including the read-only restrictions.                   |
| `vitest.config.ts`                         | Test settings and aliases.                                            |
| `.prettierignore`                          | Files the code formatter skips.                                       |
| `.env.example`                             | Empty variable names for local setup; safe to commit.                 |
| `.env.local`                               | Your private values; ignored by Git.                                  |
| `.vscode/settings.json`                    | Hides generated folders in the editor without deleting them.          |
| `next-env.d.ts`                            | Generated Next.js type references.                                    |
| `node_modules/`, `.next/`, `*.tsbuildinfo` | Generated package/build files; not code you normally edit.            |
| `.git/`                                    | Git's repository history and bookkeeping.                             |

Fonts are bundled locally through `next/font/local`: Cormorant Garamond for editorial headings, Inter for body/data, and League Spartan for labels. The font packages supply their own files; no remote font request is needed.

## A few useful terms

| Term                   | Meaning here                                                      |
| ---------------------- | ----------------------------------------------------------------- |
| Component              | A function that produces part of the screen.                      |
| Props                  | Input data passed to a component.                                 |
| API / SDK              | The service interface and package used to request SnapTrade data. |
| View model / normalize | A small display object, and the conversion that creates it.       |
| `Result<T>`            | Either successful data of type `T`, or an error message.          |
| `null`                 | A missing value; different from zero.                             |
| `.tsx` / `.ts`         | TypeScript with screen markup / TypeScript without screen markup. |

Try one small change, save it, and inspect the result with `npm run dev`. Keep secrets in `.env.local` and all brokerage access in `src/server/`.

## Hiding balances

`components/shared/BalancePrivacy.tsx` provides the header toggle, shared visibility state, and `PrivateValue` display wrapper. Wrap new monetary figures (and sensitive quantities/return percentages) in `PrivateValue` to make them respect the setting. Layout reads the `balances-hidden` cookie for the first render, so a saved hidden preference does not briefly show amounts on reload. Only the boolean preference is stored; no amounts are saved. The root provider persists across page navigation. Account names, tickers, dates, counts, chart proportions, and public FX rates stay visible.

This is display privacy for people viewing the screen, not an access-control boundary: data is still retrieved and available to the app in browser/network payloads. The toggle does not make API calls or change any calculation. `tests/components/balance-privacy.test.tsx` checks hidden rendering and sensitive table fields.

## Historical performance

`app/performance/page.tsx` loads current visible investing accounts and calls `server/load-performance.ts`. The SDK stays initialized only in `server/snaptrade.ts`, which now also exposes read-only history and reported-return methods. `load-performance.ts` normalizes them independently so a disabled history add-on does not hide a successfully retrieved return, or vice versa.

`components/performance/PerformanceDashboard.tsx` provides the account/range selectors and separate reported returns. `HistoryChart.tsx` provides a responsive SVG with pointer inspection, a keyboard-accessible date slider, and an expandable daily-value table. Date changes work from the loaded history and add no requests. Monetary values and return percentages respect Hide balances.

`lib/performance.ts` applies calendar cutoffs and aggregates only shared dates within each currency, without filling missing account values or combining unlike currencies. Daily value change is labelled as including cash flows, not as investment return. 1D is the latest available daily interval; 5D is up to five observed daily intervals. Five Year is visibly disabled because the source has a one-year maximum. Broker-return periods are matched exactly and never averaged across accounts.

SnapTrade Account Value History is beta, disabled by default, and can be enabled in its dashboard's add-ons. Its schema may change; history can have gaps. Intraday and five-year account performance require another source. Only the Performance page requests this history; no raw responses are stored. Tests in `tests/lib/performance.test.ts` and `tests/server/load-performance.test.ts` cover aggregation, ranges, date handling, missing data, and independent endpoint failures.

## Reading the holding-returns feature

1. `app/returns/page.tsx` loads investing accounts using the `history` scope, which retains zero-balance and cash-only investing accounts for historical analysis.
2. `server/load-holding-returns.ts` reads transaction pages through the private SDK adapter, normalizes security transactions, and records missing-history problems.
3. `server/return-exchange-rates.ts` estimates eligible cross-currency cash flows using dated public Bank of Canada observations, with explicit FX-estimate notes.
4. `lib/reconcile-transfers.ts` matches internal zero-cash transfers only when the original cost and both ending share counts reconcile. `lib/holding-returns.ts` then matches purchases/sales per account and aggregates by ticker/native currency.
5. `components/returns/HoldingReturnsDashboard.tsx` renders currency filters, profit/percentage ranking, sale details, reconciliation warnings, and the pending historical-price chart controls. Sorting and tab changes happen locally.

Profit equals realized plus unrealized gains/losses, plus reported dividends, minus separately attributed charges. The percentage denominator is cumulative purchase outflows across all recorded purchases, including repeat trades. It is not an annualized or time-weighted investment return. The leaderboard includes supported stocks and funds; options and shorts are excluded.

## Overview data adapter and states

`lib/overview.ts` converts existing overview data into a typed view model. `adaptOverview()` keeps unavailable fields null; `presentOverview()` converts reported investing totals into the chosen display currency, aggregates positive assets by class, and picks the five largest positive holdings. Cash/chequing contributes to the cash card, not the investing portfolio total. Cash-equivalent positions are excluded to avoid counting cash twice. Missing values, FX, shorts, and stale data produce partial-coverage notices.

`lib/overview-preview.ts` is the explicitly marked development-only sample adapter. See the README for `?preview=` URLs covering sample, skeleton loading, refreshing, empty, error/reconnect, and hidden balances. The preview error simulates a disabled connection; live connection/error handling uses the existing portfolio result. No new dependencies, brokerage calls, trading operations, or persisted financial records were added.

`StatCard`, `ChangeBadge`, `RangeToggle`, and `OverviewMoney` are reusable presentation pieces. `PrivateValue` accepts an optional placeholder; Overview uses `••••`, while other pages keep their existing display. `useBalancePrivacy()` supplies the chart blur and toggle state. The existing preference cookie persists only visibility, never balances.

## Accounts presentation

`components/accounts/Accounts.module.css` controls the four-column desktop table, stacked cards below 768px, rate popover, expandable details, and teal/gray allocation bars. It uses Overview's existing scoped design tokens for color, typography, surfaces, borders, and shadows. `components/layout/WorkspaceHeader.tsx` now supplies the same status, visibility, and ghost refresh controls to both pages. The Accounts page still requests `loadPortfolio(undefined, ["balances", "positions"])` and `loadExchangeRate()` once in parallel.

`Reported total` remains the primary figure per account. `Estimated from holdings` is a separate calculation from positions plus cash; it appears inside each account's details. Buying power is reported separately and never added to value. `CurrencyTotal` retains the existing calculation while moving its rate, date, fees/spread disclaimer, and partial-data explanation into an accessible native details popover. Allocation keeps its non-negative reported-total calculation within each currency, with a text list as its alternative.

`AccountsLoading.tsx` is the real Suspense skeleton fallback. Development-only fixtures in `lib/accounts-preview.ts` exercise sample, loading, refreshing, empty, disabled-connection error, and hidden-balance states. The README lists preview URLs; no fixture becomes a fallback for live account failures.

## Cash page and shared controls

`app/cash/page.tsx` still calls `loadPortfolio(undefined, ["balances"], "cash")` exactly once. It adds no FX or transaction requests. `lib/cash.ts` sums native cash per currency, distinguishes comparable same-currency discrepancies from mixed-currency totals, and chooses whether sync timestamps belong once in the header or individually on account rows.

`CashSummary` reuses `StatCard`, `OverviewMoney`, and the shared `CurrencyToggle`. Overview's currency buttons now use that same `CurrencyToggle` component. `WorkspaceHeader` uses shared `StatusChip` and the existing balance-visibility context; Overview, Accounts, and Cash share these controls. `InfoPopover` supplies native keyboard-accessible disclosures, outside-click dismissal, and Escape-to-close with focus returned to the trigger. The cash table reuses the Accounts responsive table/card styles, with its own three-column widths and institution-initial identity layout.

Cash values are not reconciled by silently replacing one field with another. The summary uses cash balances, not buying power or the reported account total. Account identities use the explicit DEPOSIT category for “Deposit / banking”; other cash-only investing accounts use the user-requested “HYSA” display label, with a higher-than-chequing yield assumption in the tooltip. The reported account type stays unchanged, and no interest rate or earnings are invented. Common account sync timestamps are displayed once; differing times are retained per row. The header falls back to retrieval time when there is no common valid sync, which the footer explains.

`CashLoading.tsx` is the real skeleton fallback. `lib/cash-preview.ts` provides labelled development-only previews for sample, loading, refreshing, empty, error, and hidden states without loading brokerage data. See the README for URLs.

## Cash accounts display and consistency checks

The cash redesign preserves its original data load, account visibility rules, and read-only behavior. CAD/USD selection changes only the headline native-cash subtotal. The other currency's subtotal remains visible, and no exchange-rate request or conversion is introduced. Missing currency records stay unavailable rather than becoming zero. Other currencies remain visible per account but are excluded from the CAD/USD summary and noted explicitly.

Cash and reported account totals are displayed exactly as normalized from SnapTrade. The app compares them only when all nonzero cash amounts are in the reported total's currency and the fields are available. Differences greater than roughly one cent are flagged as “Figures differ,” with possible scope/snapshot explanations. Mixed-currency totals are not directly added together or declared erroneous. A mismatch is an observation about separate reported fields, not proof that the brokerage's value is wrong. No financial values are overwritten.

The summary popover retains the full classification/exclusion explanation. DEPOSIT accounts are labelled Deposit / banking. By explicit user preference, confirmed cash-only investing accounts are labelled HYSA, with an assumed higher yield than chequing. This is a personal display classification; the original reported type remains available in the popover. No APY or interest earnings are calculated from that assumption. Header Updated uses a shared valid account sync when all rows match; otherwise it uses retrieval time and individual row times are shown when they differ. This is available account/holdings-sync metadata, not a claim of independently verified cash-price freshness.

Monetary values use the shared visibility context and `••••` placeholder; account count, names, and dates stay visible. Privacy remains display-only. Development-only cash previews use invented data and do not query SnapTrade; they are never a fallback after a real error.
