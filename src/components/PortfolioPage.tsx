// Shared page shell: navigation and states stay consistent across portfolio pages.
import { NavigationLink, NavigationReady } from "./NavigationProgress";
import type { ReactNode } from "react";
import type { AccountData, Portfolio } from "@/lib/types";
import { date } from "@/lib/format";
import { StateNotice } from "./SectionState";
const pages = [
  {
    href: "/",
    label: "Overview",
    title: "Your investments.",
    description:
      "A quick look at your portfolio. Explore the details when you need them.",
  },
  {
    href: "/accounts",
    label: "Accounts",
    title: "Your accounts.",
    description: "Balances, buying power, and account allocation.",
  },
  {
    href: "/cash",
    label: "Cash & chequing",
    title: "Your cash accounts.",
    description:
      "Banking and cash-only accounts, separate from your investments.",
  },
  {
    href: "/holdings",
    label: "Holdings & options",
    title: "What you own.",
    description: "Explore your allocation, current holdings, and options.",
  },
  {
    href: "/activity",
    label: "Activity",
    title: "Your activity.",
    description: "Recent orders and account activity, organized by account.",
  },
];
export function PortfolioPage({
  portfolio,
  path,
  children,
}: {
  portfolio: Portfolio;
  path: string;
  children: (accounts: AccountData[]) => ReactNode;
}) {
  const current = pages.find((p) => p.href === path) ?? pages[0];
  const rows =
    portfolio.accounts.status === "ok" ? portfolio.accounts.data : [];
  const partial = rows.some((a) =>
    [a.balances, a.positions, a.orders, a.activities].some(
      (r) => r.status === "error",
    ),
  );
  return (
    <>
      <NavigationReady path={path} />
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <NavigationLink href="/" prefetch={false} className="brand">
          <span className="brand-mark">h</span>holdings
          <span className="private">PRIVATE</span>
        </NavigationLink>
        <span className="read-only">● Read-only workspace</span>
      </header>
      <main id="main">
        <div className="heading">
          <div>
            <p className="eyebrow">YOUR INVESTING WORKSPACE</p>
            <h1>{current.title}</h1>
            <p className="intro">{current.description}</p>
          </div>
          {/* A full reload intentionally requests fresh data for the current page. */}
          <form action={path} method="get">
            <button className="button" type="submit">
              ↻ Refresh data
            </button>
          </form>
        </div>
        <nav className="dashboard-nav" aria-label="Portfolio pages">
          {pages.map((page) => (
            <NavigationLink
              key={page.href}
              href={page.href}
              prefetch={false}
              aria-current={path === page.href ? "page" : undefined}
            >
              {page.label}
            </NavigationLink>
          ))}
        </nav>
        <div className="timestamp">
          Retrieved {date(portfolio.retrievedAt)} · America/Toronto
          <span>No trading · No stored brokerage data</span>
        </div>
        {!portfolio.configured ? (
          <section className="panel setup">
            <p className="eyebrow">GET CONNECTED</p>
            <h2>Your portfolio starts here.</h2>
            <p>
              Add your existing Personal API credentials directly to{" "}
              <code>.env.local</code> on this machine, then restart the server.
              Use the two empty variable names in <code>.env.example</code>.
              Never enter credentials into chat or browser fields.
            </p>
            <a
              href="https://dashboard.snaptrade.com/api-key"
              target="_blank"
              rel="noreferrer"
            >
              Open SnapTrade API key settings ↗
            </a>
          </section>
        ) : portfolio.accounts.status === "error" ? (
          <StateNotice>{portfolio.accounts.message}</StateNotice>
        ) : (
          <>
            {partial && (
              <StateNotice>
                Some sections could not load. Available results remain visible;
                totals may be incomplete.
              </StateNotice>
            )}
            {rows.some((a) => a.account.stale || a.account.incomplete) && (
              <StateNotice>
                Some accounts have stale or incomplete data. Check their
                synchronization times before relying on the values.
              </StateNotice>
            )}
            {!rows.length ? (
              <p className="empty">
                {path === "/cash"
                  ? "No banking or confirmed cash-only accounts to show. Accounts reporting 0 CAD or 0 USD remain hidden."
                  : "No investing accounts to show. Accounts reporting 0 CAD or 0 USD are hidden; banking and confirmed cash-only accounts are on the Cash & chequing page."}
              </p>
            ) : (
              children(rows)
            )}
          </>
        )}
        <footer>
          <span>holdings / personal portfolio</span>
          <span>Retrieval time does not imply real-time brokerage data.</span>
        </footer>
      </main>
    </>
  );
}
