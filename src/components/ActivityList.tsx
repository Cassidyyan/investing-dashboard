import type { AccountData } from "@/lib/types";
import { date, money } from "@/lib/format";
import { SectionState } from "./SectionState";
export function ActivityList({ accounts }: { accounts: AccountData[] }) {
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
              {a.activities.status === "ok"
                ? `${a.activities.data.rows.length} records`
                : "Unavailable"}
            </span>
          </summary>
          <SectionState
            result={a.activities}
            empty={
              a.activities.status === "ok" && !a.activities.data.rows.length
            }
          >
            {(data) => (
              <>
                <p className="muted">
                  Up to 25 records from the last 90 days
                  {data.total !== null
                    ? ` · ${data.total} matching records`
                    : ""}
                  .
                </p>
                <ul className="records">
                  {data.rows.map((r, i) => (
                    <li key={i}>
                      <div>
                        <b>{r.description}</b>
                        <small>
                          {r.type} ·{" "}
                          <span className="data-text">{date(r.date)}</span>
                        </small>
                      </div>
                      <span className="numeric">{money(r.amount)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </SectionState>
        </details>
      ))}
    </>
  );
}
