import { PrivateValue } from "@/components/shared/BalancePrivacy";
import type { AccountData } from "@/lib/types";
import { date, quantity } from "@/lib/format";
import { SectionState } from "@/components/shared/SectionState";
export function OrdersList({ accounts }: { accounts: AccountData[] }) {
  return (
    <>
      {accounts.map((a) => (
        <details
          className="account-section account-disclosure"
          key={a.account.id}
        >
          <summary>
            <span>
              {a.account.name} <small>{a.account.suffix}</small>
            </span>
            <span className="badge">
              {a.orders.status === "ok"
                ? `${a.orders.data.length} records`
                : "Unavailable"}
            </span>
          </summary>
          <SectionState
            result={a.orders}
            empty={a.orders.status === "ok" && !a.orders.data.length}
          >
            {(rows) => (
              <ul className="records">
                {rows.map((o, i) => (
                  <li key={i}>
                    <div>
                      <b className="ticker">{o.symbol}</b>
                      <small className="data-text">
                        {o.action} ·{" "}
                        <PrivateValue>{quantity(o.quantity)}</PrivateValue>{" "}
                        units
                      </small>
                    </div>
                    <div className="align-right">
                      <span className="badge">{o.status}</span>
                      <small className="data-text">{date(o.placedAt)}</small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionState>
        </details>
      ))}
    </>
  );
}
