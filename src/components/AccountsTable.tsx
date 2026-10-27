import { accountCurrencyTotals } from "@/lib/currency-totals";
import type { AccountData } from "@/lib/types";
import { money, date } from "@/lib/format";
export function AccountsTable({ accounts }: { accounts: AccountData[] }) {
  return (
    <div className="table-wrap">
      <table>
        <caption className="sr-only">Accounts and reported balances</caption>
        <thead>
          <tr>
            <th>Account</th>
            <th>Institution / type</th>
            <th className="numeric">Estimated CAD value</th>
            <th className="numeric">Estimated USD value</th>
            <th className="numeric">Reported account total</th>
            <th className="numeric">Cash / buying power</th>
            <th>Holdings sync</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => {
            const totals = accountCurrencyTotals(a);
            return (
              <tr key={a.account.id}>
                <td>
                  <b>{a.account.name}</b>
                  <small className="data-text">{a.account.suffix}</small>
                </td>
                <td>
                  {a.account.institution}
                  <small>{a.account.type}</small>
                </td>
                <td className="numeric">
                  {money({ amount: totals.cad, currency: "CAD" })}
                  {totals.incomplete && (
                    <small className="warning">Partial / unavailable</small>
                  )}
                </td>
                <td className="numeric">
                  {money({ amount: totals.usd, currency: "USD" })}
                  {totals.incomplete && (
                    <small className="warning">Partial / unavailable</small>
                  )}
                </td>
                <td className="numeric">
                  {money(a.account.value)}
                  {totals.otherCurrencies.length > 0 && (
                    <small>
                      Also holds: {totals.otherCurrencies.join(", ")}
                    </small>
                  )}
                </td>
                <td className="numeric">
                  {a.balances.status === "error" ? (
                    <span className="warning">Balances unavailable</span>
                  ) : a.balances.data.length ? (
                    a.balances.data.map((b, i) => (
                      <div key={i}>
                        {money(b.cash)}
                        <small>Buying power: {money(b.buyingPower)}</small>
                      </div>
                    ))
                  ) : (
                    "No balances reported"
                  )}
                </td>
                <td className="data-text">
                  {date(a.account.syncedAt)}
                  {a.account.incomplete && (
                    <small className="warning">Incomplete / unavailable</small>
                  )}
                  {a.account.stale && (
                    <small className="warning">Over 36 hours old</small>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
