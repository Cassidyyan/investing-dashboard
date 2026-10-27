import type { AccountData } from "@/lib/types";
import { date, money } from "@/lib/format";
import { SectionState } from "./SectionState";
export function CashAccountsTable({ accounts }: { accounts: AccountData[] }) {
  return (
    <div className="table-wrap">
      <table>
        <caption className="sr-only">
          Cash and chequing account balances
        </caption>
        <thead>
          <tr>
            <th>Account</th>
            <th>Institution / reported type</th>
            <th className="numeric">Reported total</th>
            <th className="numeric">Cash by currency</th>
            <th>Last account sync</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => (
            <tr key={a.account.id}>
              <td>
                <b>{a.account.name}</b>
                <small className="data-text">{a.account.suffix}</small>
              </td>
              <td>
                {a.account.institution}
                <small>{a.account.type}</small>
                <small>
                  {a.account.category === "DEPOSIT"
                    ? "Brokerage category: deposit / banking"
                    : "No open holdings · may be a cash-only investing account"}
                </small>
              </td>
              <td className="numeric">{money(a.account.value)}</td>
              <td className="numeric">
                <SectionState
                  result={a.balances}
                  empty={a.balances.status === "ok" && !a.balances.data.length}
                >
                  {(balances) => (
                    <>
                      {balances.map((b, i) => (
                        <div key={i}>{money(b.cash)}</div>
                      ))}
                    </>
                  )}
                </SectionState>
              </td>
              <td className="data-text">
                {date(a.account.syncedAt)}
                {a.account.incomplete && (
                  <small className="warning">Incomplete data</small>
                )}
                {a.account.stale && (
                  <small className="warning">Over 36 hours old</small>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
