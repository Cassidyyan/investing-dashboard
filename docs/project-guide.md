# Understanding the project

[← Start here](../README.md) · [Security and data behavior](security-and-data.md)

## Pages

| URL         | What you see                                                        |
| ----------- | ------------------------------------------------------------------- |
| `/`         | A short overview with summary cards and links to the detailed pages |
| `/accounts` | Account balances, with account allocation in a collapsed panel      |
| `/holdings` | Holdings/options tabs and collapsible allocation charts             |
| `/activity` | Orders and activity, collapsed by account                           |

Each route has its own `page.tsx` inside `src/app/`. `components/PortfolioPage.tsx` provides their shared navigation, heading, setup instructions, and warning states. Links disable prefetch so navigation does not fetch financial data before you choose a page. Expanding a section uses data already loaded by that page.

`loadPortfolio()` checks positions once per account on every page to exclude accounts confirmed to have no open holdings, then loads requested sections: the overview requests balances; accounts also requests balances; holdings uses those positions; activity requests orders and activities. Zero-CAD/USD accounts are excluded before requesting details. Confirmed empty accounts are excluded before loading balances, orders, or activity. Failed holdings requests, unknown position quantities, and incomplete or stale accounts stay visible. This is a display filter, not a claim that empty accounts are definitely chequing or savings accounts. No financial responses are stored between page visits, so rapid navigation can still trigger rate limits.

The **Cash & chequing** page lives at `app/cash/page.tsx`. It calls `loadPortfolio(undefined, ["balances"], "cash")` and displays `CashAccountsTable.tsx`. Accounts categorized by SnapTrade as `DEPOSIT` belong here; accounts with confirmed empty holdings are also included, but their original investing types stay visible. Credit/line-of-credit accounts (`LOC`) are excluded from this cash view. Explicit deposit accounts need only balances, without a positions request. Zero-CAD/USD accounts stay hidden. Failed, stale, or incomplete holdings do not establish that an otherwise unclassified account belongs on the cash page.

## How data reaches the screen

```text
You open the dashboard in your browser
  → app/page.tsx asks loadPortfolio() for display data
    → server/load-portfolio.ts requests accounts and their details
      → server/snaptrade.ts makes read-only SnapTrade API calls
    → server/normalize.ts simplifies the API responses
  → page.tsx passes the display data to components
Your browser displays the resulting page
```

The server is the local Node.js process started by `npm run dev`. The browser is the window where you view the app. Keeping those jobs separate prevents the SnapTrade credentials from being included in browser code.

The initial page is assembled on the server for each visit. Even though most components also render on the server, their job is only presentation: they receive data and display it. They do not request brokerage data themselves. `error.tsx` runs in the browser so its retry button can respond to a click.

## Application files

Paths below are relative to `src/`.

| File                       | Responsibility                                                        |
| -------------------------- | --------------------------------------------------------------------- |
| `app/page.tsx`             | Overview; summary cards and links to detailed pages                   |
| `app/layout.tsx`           | Shared page shell, page title, and global stylesheet import           |
| `app/globals.css`          | Colors, spacing, typography, tables, and mobile layout                |
| `app/loading.tsx`          | Screen shown while the page is loading                                |
| `app/error.tsx`            | Recovery screen when the page cannot render                           |
| `server/snaptrade.ts`      | The only place the SDK client is created; exposes six read operations |
| `server/load-portfolio.ts` | Loads account data concurrently and handles partial failures          |
| `server/normalize.ts`      | Converts API data into small objects used by the page                 |
| `lib/types.ts`             | Describes the shape of those objects                                  |
| `lib/format.ts`            | Formats money, quantities, and dates for display                      |

`server-only` at the top of each server file tells Next.js to reject attempts to import it into browser code.

## Dashboard components

Each component has the same basic pattern: accept input data, then return the screen elements to display.

| Component              | What it displays                                                                |
| ---------------------- | ------------------------------------------------------------------------------- |
| `SummaryCards.tsx`     | Portfolio totals by currency, cash, and account count                           |
| `AccountsTable.tsx`    | Account names, masked numbers, balances, and sync times                         |
| `PositionsTable.tsx`   | Securities held in each account                                                 |
| `AllocationBar.tsx`    | Relative account values within each currency                                    |
| `OrdersList.tsx`       | Recent orders, with no controls to change them                                  |
| `ActivityList.tsx`     | Recent transactions and other activity                                          |
| `ConnectionStatus.tsx` | Optional connection-status component; currently not displayed                   |
| `SectionState.tsx`     | Shared handling for unavailable or empty sections; also exports warning notices |

`lib/holdings.ts` groups positive position values for the pie chart and recognizes option instrument kinds. Unlike the data loaders, it does not make API calls. `PositionsTabs.tsx` runs in the browser to switch between panels already rendered by the server.

## Files you usually leave alone

| File or folder          | Why it exists                                                                   |
| ----------------------- | ------------------------------------------------------------------------------- |
| `package.json`          | Lists scripts and dependencies: packages needed by the app or development tools |
| `package-lock.json`     | Records exact package versions so installs are repeatable; npm maintains it     |
| `next.config.ts`        | Configures Next.js and private-response headers                                 |
| `next-env.d.ts`         | Next.js maintains these framework type references                               |
| `tsconfig.json`         | TypeScript settings; maps `@/` imports to `src/`                                |
| `eslint.config.mjs`     | Code checks and restrictions against trading and public SnapTrade credentials   |
| `vitest.config.ts`      | Test runner settings; replaces the server-only marker only inside tests         |
| `.prettierignore`       | Tells the formatter which generated files to skip                               |
| `.gitignore`            | Keeps credentials and generated files out of Git                                |
| `.vscode/settings.json` | Hides generated folders in the editor; does not delete them                     |
| `node_modules/`         | Installed third-party packages; recreated by `npm ci`                           |
| `.next/`                | Generated app files; recreated when you run or build Next.js                    |
| `*.tsbuildinfo`         | TypeScript's generated information for faster later checks                      |
| `.git/`                 | Git's history and internal bookkeeping                                          |

The Accounts page also loads the public Bank of Canada daily exchange rate through `server/exchange-rate.ts`. `lib/currency-totals.ts` estimates native CAD/USD totals without double-counting cash equivalents, and `components/CurrencyTotal.tsx` displays their combined USD estimate. No credentials are used for the rate feed.

## Tests

- `tests/currency-totals.test.ts` checks native currency totals, cash-equivalent exclusions, exchange-rate direction, validation, and feed failures.
- `tests/normalize.test.ts` checks amounts, currencies, account masking, and position calculations.
- `tests/partial-failure.test.ts` checks that one failed request does not hide successful sections or expose upstream error details.
- `tests/holdings.test.ts` checks allocation grouping, currency separation, exclusions, and option classification.
- `tests/server-only.ts` is a test helper, not a test case. It lets the tests import server functions outside Next.js. The real app still uses the actual `server-only` package.

The tests use small invented examples rather than your brokerage account. The running dashboard never uses those examples as a fallback.

## A few terms used in the code

| Term                 | Meaning here                                                        |
| -------------------- | ------------------------------------------------------------------- |
| Component            | A function that produces a piece of the screen                      |
| Props                | The input data passed to a component                                |
| API                  | The interface the app calls to request SnapTrade data               |
| SDK                  | SnapTrade's package for making those calls                          |
| View model           | A small object containing just what the screen needs                |
| Normalize            | Convert an external response into a view model                      |
| `Result<T>`          | Either successful data of type `T`, or an error message             |
| `null`               | A missing or unavailable value; different from zero                 |
| `Promise.allSettled` | Wait for all requests, keeping track of both successes and failures |
| `.tsx`               | TypeScript that can describe screen elements using JSX              |
| `.ts`                | TypeScript without JSX screen markup                                |

## Where to make your first change

| If you want to…                                 | Start with…                                               |
| ----------------------------------------------- | --------------------------------------------------------- |
| Change the dashboard title or introductory text | `src/app/page.tsx`                                        |
| Change colors, spacing, or mobile layout        | `src/app/globals.css`                                     |
| Change a table heading                          | `src/components/AccountsTable.tsx`                        |
| Change how dates or amounts look                | `src/lib/format.ts`                                       |
| Understand a missing balance                    | `src/server/normalize.ts`, then the partial-failure tests |

Try one small change at a time, save it, and inspect the result with `npm run dev`. Credentials belong only in `.env.local`, and the code in `src/server/` remains the boundary for all brokerage access.

## Navigation animation

`NavigationProgress.tsx` lives in the root layout so it survives page changes. `NavigationLink` starts the loading illustration only for normal same-tab navigation. `NavigationReady` is rendered with the finished page, after its data has loaded, and triggers the short crash animation. The error page also signals completion; cancelled navigation clears pending timers. `StonkLoader.tsx` contains the decorative SVG, and `globals.css` defines the rise and crash animations. The loading fallback uses the same illustration. Reduced-motion settings disable animation. This UI does not make API requests or represent actual returns.

## Typography

The app uses **Cormorant Garamond** for page headings and editorial accents, **Inter** for body text, navigation content, and financial values, and **League Spartan** for section headings, labels, and controls. These are the free alternatives in the requested Wealthsimple-inspired font philosophy; no proprietary Wealthsimple fonts are bundled. Numeric columns retain tabular figures, slashed zeros, and right alignment for readable comparisons.

Font files come from the `@fontsource-variable/cormorant-garamond`, `@fontsource-variable/inter`, and `@fontsource-variable/league-spartan` dependencies and are bundled through `next/font/local` in `app/layout.tsx`. Fonts are served by this app rather than a remote font service. `globals.css` defines `--font-editorial`, `--font-ui`, `--font-label`, and `--font-data`. Use `.numeric` for right-aligned amounts and `.data-text` for other data labels. The rounded cards and mint palette remain in place.

## Option contract details

`OptionsDetails.tsx` is the Current options panel. It shows per-account, expandable option cards instead of the generic positions table. `normalize.ts` preserves the contract's type, strike, expiration, multiplier, and underlying identity. `lib/option-details.ts` validates date-only expiry values, counts calendar days in America/Toronto, and classifies moneyness only with a recent, matching, same-currency underlying position price. The ATM display band is within 0.5% of strike. It is a display convention, not a profit or exercise recommendation.

The current data setup has no options market-data provider. Greeks and IV are marked unavailable in a collapsed section. SnapTrade's option quote endpoint retired October 1, 2026; this app does not call it or estimate Greeks from position prices. No extra API calls were added. `tests/option-details.test.ts` checks metadata, expiration dates, timezone/DST boundaries, moneyness, and underlying-price matching.

## Industry allocation

The Holdings & options page has a separate, collapsible **Industry allocation · all accounts** chart. `lib/security-industries.ts` contains reviewed, app-maintained business groups and issuer-source links for the current ticker set; it is not an official GICS feed. Edit this file to update or add a classification. Unknown listings go into Unclassified instead of disappearing. ETFs and trusts use separate fund groups; the app does not estimate their underlying industry mix.

`lib/industry-allocation.ts` aggregates positive stock/fund values across accounts into USD, dividing CAD values by the latest Bank of Canada CAD-per-USD rate. Options, cash equivalents, crypto, shorts, and unsupported/missing valuations are excluded. A missing FX rate blocks the combined chart if it contains CAD, while the original currency charts remain available. `IndustryPieChart.tsx` renders the top three groups plus Other, with scrollable dropdowns and issuer-source drilldowns. `AllocationPie.tsx` shares the smooth SVG renderer between both pie views. Classification metadata is local; this adds only the public FX request, with no extra SnapTrade calls.

## Sorting holdings

`PositionsTable.tsx` remains on the server and prepares display rows with validated logo URLs. It passes these rows to `SortableHoldingsTable.tsx`, a small client component with local sort state per account. Click Quantity, Avg. cost, Last price, Market value, or Net return to sort descending; click the same heading again to sort ascending. The default is highest market value first. Buttons support keyboard input and table headers expose `aria-sort`.

`lib/sort-positions.ts` compares numeric values, keeps unknown values last in either direction, preserves ties and original input arrays, and retains stable row identities. Monetary sorts compare displayed native-currency amounts without FX conversion; net return sorts dollar amounts rather than percentages. Sorting adds no API calls or storage. `tests/sort-positions.test.ts` covers those rules.

## Overview cash balance

The overview uses `loadPortfolio(undefined, ["balances"], "overview")` to load investing, banking, and confirmed cash-only accounts in one pass. `cashOnly` marks accounts routed to Cash & chequing. `SummaryCards` receives investing accounts for reported portfolio value and account count, plus all included accounts for cash totals. Cash stays separated by currency. Credit accounts and the existing zero-CAD/USD exclusions stay out. Missing/stale banking balances flag the cash card as partial. This avoids fetching the same investing positions twice for separate investing and cash loads.
