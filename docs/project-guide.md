# Understanding the project

[Start here](../README.md) · [Security and data behavior](security-and-data.md)

Start with the page you want to change, then follow its imports. Routes load data, feature components display it, and helpers perform calculations. Shared controls and styles have their own folders.

## Folder map

```text
src/
├── app/                    Next.js routes and global layout
│   ├── page.tsx            Overview (/)
│   ├── accounts/page.tsx   Investing accounts (/accounts)
│   ├── cash/page.tsx       Cash & chequing (/cash)
│   ├── holdings/page.tsx   Holdings & options (/holdings)
│   ├── performance/        Account value history
│   ├── returns/            Lifetime holding-return estimates
│   ├── activity/           Orders and transactions
│   ├── layout.tsx          Fonts and shared providers
│   ├── loading.tsx         Navigation loading screen
│   ├── error.tsx           Page-level retry screen
│   └── globals.css         Global styles and older page styles
├── components/
│   ├── layout/             Header, navigation, page shell, loading animation
│   ├── shared/             Reusable cards, money, badges, privacy and controls
│   ├── overview/           Overview-specific UI
│   ├── accounts/           Investing-account UI
│   ├── cash/               Cash-account UI
│   ├── holdings/           Positions, filters, rows and allocation
│   ├── options/            Contract details
│   ├── performance/        Account history chart and controls
│   ├── returns/            Holding-return leaderboard
│   └── activity/           Orders and transaction lists
├── lib/                    Pure data helpers; no credentials or network calls
│   ├── types.ts            Shared data shapes (Money, Result, AccountData…)
│   ├── format.ts           Currency, date, quantity and return formatting
│   ├── navigation.ts       Page destinations and navigation groups
│   ├── accounts/           Native currency totals and combined estimates
│   ├── financial/          Decimal values, validation, provenance and source models
│   ├── cash/               Cash totals, comparisons and sync metadata
│   ├── holdings/           Allocation, industries and holding view models
│   ├── options/            Contracts, quantity reconciliation, expiry and moneyness
│   ├── overview/           Overview view model and display conversion
│   ├── performance/        History dates, ranges and aggregation
│   └── returns/            Lifetime returns and transfer reconciliation
├── server/                 Server-only API access and normalization
├── styles/
│   └── dashboard.module.css  Shared dashboard design tokens and layout
└── dev/
    └── previews/           Explicitly invented development fixtures

tests/
├── lib/                    Mirrors lib's feature folders
├── components/             UI rendering, privacy and state checks
├── server/                 Normalization, loading and partial failures
└── helpers/                Test-only server-only module replacement
```

Feature CSS modules stay next to their components. For example, `components/holdings/Holdings.module.css` styles the positions screen. The shared `styles/dashboard.module.css` supplies the dashboard's common colors, typography, cards and layout utilities.

## Follow one request

```text
app/accounts/page.tsx
  → server/load-portfolio.ts requests the required data
    → server/snaptrade.ts makes read-only SDK calls
    → server/normalize.ts prepares display objects
  → components/accounts/AccountsDashboard.tsx composes the screen
    → components/accounts/AccountsTable.tsx renders accounts
    → lib/accounts/currency-totals.ts prepares currency estimates
```

The server is the local Node.js process started with `npm run dev`. Components marked `"use client"` handle browser interactions. Sorting, filters, tabs and disclosures use already-loaded data; they do not call the brokerage.

## Where to make a change

| Change                                     | Start here                                                                   |
| ------------------------------------------ | ---------------------------------------------------------------------------- |
| A page's data requirements                 | Its file in `src/app/`, then the matching server loader                      |
| Overview layout                            | `src/components/overview/OverviewDashboard.tsx`                              |
| Account rows                               | `src/components/accounts/AccountsTable.tsx`                                  |
| Cash rows                                  | `src/components/cash/CashAccountsTable.tsx`                                  |
| Holdings filters, tabs and grouping        | `src/components/holdings/HoldingsDashboard.tsx`                              |
| Holdings columns or expanded details       | `HoldingsTable.tsx` and `HoldingRow.tsx` in that folder                      |
| Allocation presentation                    | `AllocationCard.tsx`, `AllocationDonut.tsx`, `AllocationBars.tsx`            |
| Allocation calculations                    | `src/lib/holdings/holdings-view.ts`, `holdings.ts`, `industry-allocation.ts` |
| Stock industry labels                      | `src/lib/holdings/security-industries.ts`                                    |
| Option expiry and moneyness                | `src/lib/options/option-details.ts`                                          |
| Holding-return calculations                | `src/lib/returns/holding-returns.ts` and `reconcile-transfers.ts`            |
| Navigation order                           | `src/lib/navigation.ts`                                                      |
| Header and refresh                         | `src/components/layout/WorkspaceHeader.tsx`                                  |
| Shared cards, money, badges and controls   | `src/components/shared/`                                                     |
| Dashboard design system                    | `src/styles/dashboard.module.css`                                            |
| One feature's spacing or responsive layout | That feature's adjacent `.module.css` file                                   |
| Fonts                                      | `src/app/layout.tsx`                                                         |
| Missing data                               | Matching loader in `src/server/`, then `normalize.ts` and its tests          |
| Sample UI states                           | `src/dev/previews/`                                                          |

`MoneyValue.tsx` is the shared privacy-aware currency display. `ChangeBadge.tsx` displays existing gains/losses; `StatCard.tsx` supplies a consistent card and heading. `CurrencyToggle`, `StatusChip`, `InfoPopover`, `SecurityIcon`, and `BalancePrivacy` are shared across features. `PortfolioLinks` and the main navigation both use destinations from `lib/navigation.ts`.

## Server files

All files in `src/server/` start with `import "server-only"`. `load-overview.ts` composes shared loaders for Overview; `load-account-funding.ts` supplies dated external funding for history-backed estimates.

| File                        | Responsibility                                                         |
| --------------------------- | ---------------------------------------------------------------------- |
| `snaptrade.ts`              | The sole SDK initialization and read-only adapter                      |
| `load-portfolio.ts`         | Concurrent account sections, partial failures and account scopes       |
| `normalize.ts`              | Safe display objects, masked account numbers and normalized valuations |
| `normalize-transactions.ts` | Source-faithful transactions and cumulative order snapshots            |
| `transaction-pages.ts`      | Bounded, scope/identity/coverage-checked historical transaction reader |
| `request-protection.ts`     | In-flight deduplication, concurrency, queue and provider cooldown      |
| `retry-after.ts`            | Validated provider cooldown header parsing                             |
| `exchange-rate.ts`          | Latest public Bank of Canada daily reference rate                      |
| `load-performance.ts`       | Account history, reported returns, and conditional funding loads       |
| `load-holding-returns.ts`   | Available transaction history for the leaderboard                      |
| `return-exchange-rates.ts`  | Dated reference rates for labelled historical FX estimates             |
| `security-logo.ts`          | Logo.dev URLs using only the publishable key                           |

## Overview history and activity

`server/load-overview.ts` composes current portfolio sections, recent activities, the daily reference rate and shared Performance history/funding. It makes no separate legacy return-rate request. `lib/overview/history.ts` groups native-currency histories, selects date ranges, attaches latest daily account changes, and computes the same recorded-net-deposit gain used in Performance. `lib/overview/overview.ts` maps dated recent activity and keeps current reported values separate.

`PortfolioHero.tsx` renders connected history, coverage and dates. When a selected display currency has no history, it uses an available native currency with explicit chart/statistic labels. `AccountList.tsx` shows each account's latest dated change; `OverviewActivityList.tsx` shows up to five newest retrieved transactions, keeping original currencies. Existing skeletons, errors, refresh and privacy controls apply. `/?preview=history` uses labelled invented fixtures for this path.

## Historical performance inspection

`components/performance/PerformanceChart.tsx` selects the closest daily point on hover, touch, or left/right arrow keys. `HistoryInspection.tsx` renders the selected date's two metrics and unavailable reasons. Styling lives beside them in `Performance.module.css`.

`server/load-account-funding.ts` reads all available paginated transactions only for accounts with a value chart. It normalizes contributions/withdrawals, flags unknown or unsupported transfers, validates pagination and continues through available history without a year or record-count cutoff. `load-performance.ts` runs these funding reads sequentially and stops requesting them after a rate limit. No raw transactions are persisted. Whole-history reads can be reused in server memory for 60 seconds, with retrieval/coverage metadata; a two-minute read budget marks partial results explicitly.

`lib/performance/cash-flow-returns.ts` calculates gain versus net deposits up to the inspected date and an estimated Modified Dietz return from the first visible snapshot to that date. Date-range changes reset the period baseline, while cumulative net deposits retain their full recorded history. Currency groups use exactly the same accounts as the value chart. Tests use the labelled fixture in `dev/previews/performance-preview.ts`; `/performance?preview=sample` enables it only in development and makes no brokerage calls.

## Financial and options foundations

Read [the Phase 1 audit](phase-1-audit.md) for the prioritized findings. `lib/financial/` contains exact decimal operations, common validators, provenance/status fields and normalized transaction/order types. `server/normalize-transactions.ts` is the source adapter; legacy UI records remain compatible numeric projections.

`lib/options/contracts.ts` normalizes source contracts and conservatively parses OCC symbols. `reconcile-executions.ts` links explicit opening/closing quantities; it does not fetch or calculate P&L. `types.ts` separates execution, lifecycle and strategy models, with an unimplemented repository interface. See [options capabilities](options-data-foundation.md) before adding analytics and [the storage proposal](historical-storage-plan.md) before retaining brokerage data.

## Organization rules

- Put route entry points in `app/`; keep screen composition in `components/<feature>/`.
- Put UI used by multiple features in `components/shared/`, not in another feature's folder.
- Put pure calculations in `lib/<feature>/`; keep fetching and credentials in `server/`.
- Keep feature CSS beside its components. Add common dashboard styles to `styles/`.
- Use `@/` for imports across folders. Short relative imports within a component folder are fine.
- Keep imports explicit rather than adding large `index.ts` re-export files; this makes server/client dependencies easier to follow.
- Put invented fixtures in `dev/previews/`; use them only in labelled development previews and tests. Never substitute them after a live request fails.
- Mirror calculation folders in `tests/lib/`. Add tests beside the corresponding test group, not inside route folders.

Obsolete account accordions, position tables, connection-health UI and old pie-chart wrappers were removed after their privacy and SVG checks were moved to the active holdings components. The financial allocation helpers remain. Holdings sorting lives in `components/holdings/HoldingsTable.tsx` and is covered by `tests/components/holdings-dashboard.test.tsx`; the obsolete standalone sorter and its tests have been removed.

## Local checks

```sh
npm run typecheck
npm run lint
npm test
npm run format:check
npm run build
```

Tests use invented data and do not require brokerage credentials. `vitest.config.ts` maps `server-only` to a test replacement, allowing server logic to be tested outside Next.js.

Keep tool configuration at the project root: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.ts`, and `.prettierignore`. Next.js generates `next-env.d.ts`; npm and Next.js generate `node_modules/`, `.next/`, and `*.tsbuildinfo`. These are not folders to organize manually.

`.env.example` contains empty variable names for setup. `.env.local` contains local private values and must stay ignored by Git. See [Security and data behavior](security-and-data.md) for credentials, privacy, account classification, currency scopes and data limitations.

## Performance page components

`app/performance/page.tsx` keeps the same `loadPortfolio(undefined, ["positions"])` followed by `loadPerformance()` calls. A Suspense boundary renders `PerformanceLoading` while they finish. The page passes the existing portfolio metadata into `PerformanceDashboard` for type badges, connection states and timestamps.

- `PerformanceDashboard`: shared header/navigation, account/currency/range controls, refresh and page states.
- `PerformanceHero`: latest observed value, existing change calculation, source/methodology popover and funding estimates.
- `PerformanceChart`: observed-day area/line, dashed gap segments, hover/touch/keyboard inspection and Chart/Table modes.
- `ChartTooltip`: selected value and previous-observation change plus the existing funding-based percentages.
- `PerformanceStats`: Start, Current, High, Low.
- `AccountPerformanceList`: available per-account histories, original masked numbers/type metadata, changes and sparklines.
- `ReportedReturnsCard`: one empty state or a compact supported-period matrix with missing-value disclosures.
- `SetupBanner`: conditional source guidance and retry.

`lib/performance/presentation.ts` prepares chart coordinates and delegates financial changes to the unchanged `historyChange()` helper. Existing history aggregation, range selection, funding and FX rules remain unchanged. The generic `components/shared/RangeToggle.tsx` now serves both Overview and Performance. `PortfolioLinks` also accepts the Performance navigation group, and the shared header/status accept an optional Data through date.

The old `HistoryChart.tsx` was replaced by the split components above. The native account control and all feature styling live in `Performance.module.css`. Development previews now include `sample`, `mixed`, `reported`, `single`, `empty`, `error`, `loading`, `refreshing` and `hidden`; none call SnapTrade or become live fallbacks.

## Holding Returns presentation

`app/returns/page.tsx` preserves its existing sequence: portfolio history scope → holding transactions → historical FX → `calculateHoldingReturns()`. It passes the same calculated rows/issues to `HoldingReturnsDashboard`, plus already-loaded portfolio metadata and security descriptions where available. A Suspense boundary uses `ReturnsLoading` without mock figures.

The feature lives in `components/returns/`:

| Component                             | Responsibility                                                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------------- |
| `HoldingReturnsDashboard`             | Shared page shell, currency/account/search/sort/view state, refresh and source errors       |
| `EstimatesStrip` / `EstimatesDrawer`  | Compact coverage status and native modal methodology/coverage notes                         |
| `ProfitSummary`                       | Ranked native-currency totals and component breakdown                                       |
| `BestWorstCards`                      | Highest/lowest total profit, independent of table sorting                                   |
| `LeaderboardTable` / `LeaderboardRow` | Top-ten/full list, mobile cards and expandable holding details                              |
| `ProfitBar`                           | Zero-centered positive/negative display; never a new financial calculation                  |
| `NeedsDataCard`                       | Existing unranked issues grouped into counted reason filters                                |
| `ReturnValue`                         | Shared ChangeBadge wrapper, currency-free table amounts, zero dashes and signed percentages |

`lib/returns/presentation.ts` sorts copies of rows, sums existing ranked fields and groups issue text for display. It never changes basis, eligibility, transfers or FX. `signedAmount()` in `lib/format.ts` retains native currency precision while omitting the currency code for labelled tables; shared `ChangeBadge` accepts an optional `showCurrency` setting. The financial engine remains `lib/returns/holding-returns.ts`.

`Returns.module.css` contains all feature styling. Obsolete Performance/Returns global styles were removed after both pages moved to scoped modules. `dev/previews/returns-preview.ts` contains only labelled invented examples. Tests cover total/component consistency, full-set sorting, issue grouping, privacy, and page states. Browser previews exercise drawer focus/Escape, row expansion, filters and responsive layouts without live brokerage requests.

## Shared request controls and browser checks

`components/shared/useProtectedRefresh.ts` is the shared browser refresh/retry hook; `ActivityDashboard.tsx` uses it with the same shared header as other pages. `server/request-protection.ts` wraps the adapter's existing reads with in-flight deduplication, concurrency limits and rate-limit cooldowns without caching completed brokerage data.

`tests/browser/` contains Playwright accessibility and interaction checks, run with `npm run test:browser`. Their `.pw.mjs` filenames keep them separate from Vitest unit tests. Loading skeletons are decorative and hidden from assistive technology; the surrounding page supplies the loading announcement. InfoPopover accessible names retain visible badge/trigger text, and page landmarks have distinct names.

## Presentation polish and Activity

`components/shared/Money.tsx` owns currency formatting and privacy masking; `MoneyValue` is its compatibility wrapper. `PrivateValue` reserves a formatted-text width and one line of height, and removes sensitive text when hidden. Percentages stay visible. `Select.tsx` supplies consistently styled native selects, the keyboard-accessible Switch, and the sort-direction icon button. `SampleNotice` supplies the slim development-only notice.

Activity now renders `ActivityDashboard` with the unchanged `loadPortfolio(undefined, ["orders", "activities"])` result. Its feed, account/type/search filters, date groups, and fifteen-item display limit operate on already-loaded items. Orders expose quantity/status rather than inventing monetary execution data. The old page shell and per-account lists were removed. Unit tests cover loading/empty/error/privacy; browser checks also cover the current live read-only Activity view.

Layout regressions cover all eight pages at 1440, 820 and 390 pixels, hidden-value dimensions, fixed allocation tracks, the ETA zero-value row, and the twelve-pixel profit-components bar.

## Options Analytics

The new route is `app/options-analytics/page.tsx`. `server/load-options-analytics.ts` reuses existing account scopes, transaction pagination, normalization and request guards; it does not read orders or introduce another provider. `lib/options/ledger.ts` creates quantity-matched lifecycles, `execution-cash.ts` verifies cash/fee semantics, and `analytics.ts` applies local filters and exact native-currency aggregation. `components/options-analytics/` holds the shared-style dashboard, filters, summary, charts, underlying table, journal and coverage disclosures. Synthetic states live in `dev/previews/options-analytics-preview.ts`.

See [Options Analytics](options-analytics.md) for eligibility, allocation, date scopes and missing data. Calculation changes belong in the pure helpers and their tests, not chart or table components.

## Historical-data recovery

Read [the historical-data audit](history-recovery-audit.md) for the actual source findings and import proposal. `server/transaction-pages.ts` handles complete/partial snapshots, pagination and bounded memory reuse. `history-quality.ts` counts applicable source field gaps and keeps transaction sync separate from holdings. `history-diagnostics.ts` emits aliases/dates/counts only; it exposes no public HTTP endpoint. `components/shared/HistoryCoverage.tsx` discloses API completion independently of brokerage lifetime coverage. No database or importer was introduced.

Read [the Holding Returns recovery notes](holding-returns-recovery.md) for closed-position freshness checks, repeated internal transfer reconciliation and remaining purchase-cost gaps. `lib/returns/closed-snapshot.ts` verifies older empty snapshots; `reconcile-transfer-chains.ts` requires a unique cost-carrying path and matching ending shares. Missing-data reason popovers identify affected accounts and the supporting records needed.

The local [CSV reconciliation layer](csv-reconciliation.md) is shared by Holding Returns and Options Analytics. `server/wealthsimple-import.ts` reads ignored exports; `lib/imports/reconcile-activities.ts` corroborates accounts and overlapping executions; `csv-option-history.ts` builds an explicitly scoped CSV option cohort; `server/reconcile-holding-import.ts` validates additional stock rows against ending shares. Reconciliation runs in memory without personal mappings in source code or normalized archives on disk.
