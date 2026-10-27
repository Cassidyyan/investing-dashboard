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
│   ├── components/           Reusable parts of the dashboard
│   ├── server/               Private code that reads SnapTrade data
│   └── lib/                  Shared data types and formatting helpers
├── tests/                    Checks for calculations and API failures
├── .env.example              Shareable template; empty variable names only
├── .env.local                Your private credentials; ignored by Git
├── .gitignore                Rules for what stays out of Git
├── package.json              Commands and required packages
└── package-lock.json         Exact package versions; keep this in Git
```

There are a few configuration files at the top level because the development tools look for them there. You usually won't need to edit them. The [project guide](docs/project-guide.md) explains each one.

## Pages

- **Overview** (`/`): summary cards and links to the rest of the app.
- **Accounts** (`/accounts`): separate estimated CAD/USD values, collapsible allocation, and a combined USD estimate using the latest Bank of Canada daily rate. Accounts with a reported total of 0 CAD or 0 USD are hidden.
- **Holdings & options** (`/holdings`): position tabs, with charts and per-account details collapsed until needed.
- **Activity** (`/activity`): recent orders and transactions, collapsed by account.

**Cash & chequing** (`/cash`) shows brokerage-identified banking accounts and accounts confirmed to have no open holdings. They stay out of investing pages and totals. Zero-CAD and zero-USD accounts remain hidden. Failed holdings requests and incomplete data remain visible.

Open a panel by clicking its heading. Expanding panels and switching position tabs do not make more API requests.

## Read the code in this order

1. [page.tsx](src/app/page.tsx): the overview page. It loads balances and shows summary cards and navigation links.
2. [AccountsTable.tsx](src/components/AccountsTable.tsx): a component that turns account data into a table.
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
