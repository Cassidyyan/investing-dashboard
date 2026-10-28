import type { PerformanceAccount } from "@/lib/types";
import { signedPercent, date } from "@/lib/format";
import { StatCard } from "@/components/shared/StatCard";
import { InfoPopover } from "@/components/shared/InfoPopover";
import styles from "./Performance.module.css";
const periods = ["1D", "1M", "YTD", "1Y"] as const;
export function ReportedReturnsCard({
  accounts,
}: {
  accounts: PerformanceAccount[];
}) {
  const available = periods.filter((period) =>
    accounts.some(
      (a) =>
        a.returns.status === "ok" &&
        a.returns.data.some((r) => r.timeframe === period),
    ),
  );
  return (
    <StatCard
      title="Brokerage-reported returns"
      action={
        <InfoPopover label="Brokerage return availability">
          <p>
            Reported directly by your brokerage. These percentages are distinct
            from change in account value and the app’s funding estimates. No
            returns are averaged across accounts or substituted between periods.
          </p>
        </InfoPopover>
      }
    >
      <p className={styles.caption}>Reported by your brokerage</p>
      {!available.length ? (
        <div className={styles.empty}>
          <p>
            No brokerage-reported returns are available for the selected
            accounts.
          </p>
          <InfoPopover
            label="How to enable reported returns"
            trigger="How to enable"
            align="start"
          >
            <p>
              Check your account’s access in SnapTrade and whether the brokerage
              supplies return rates. Enabling account value history does not
              guarantee brokerage-reported returns. Refresh after reconnecting
              or updating access.
            </p>
            <a
              href="https://dashboard.snaptrade.com"
              target="_blank"
              rel="noreferrer"
            >
              Open SnapTrade ↗
            </a>
          </InfoPopover>
        </div>
      ) : (
        <table className={styles.reportedTable}>
          <caption className={styles.srOnly}>
            Returns reported by your brokerage
          </caption>
          <thead>
            <tr>
              <th scope="col">Account</th>
              {available.map((p) => (
                <th scope="col" key={p}>
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <th scope="row">
                  {a.name}
                  <small>{a.suffix}</small>
                </th>
                {available.map((period) => {
                  const value =
                    a.returns.status === "ok"
                      ? a.returns.data.find((r) => r.timeframe === period)
                      : undefined;
                  return (
                    <td key={period} data-label={period}>
                      {value ? (
                        <InfoPopover
                          label={`Reported ${period} date for ${a.name}`}
                          trigger={
                            <span
                              className={
                                value.percent > 0
                                  ? styles.gain
                                  : value.percent < 0
                                    ? styles.loss
                                    : undefined
                              }
                            >
                              <span aria-hidden="true">
                                {value.percent > 0
                                  ? "↑ "
                                  : value.percent < 0
                                    ? "↓ "
                                    : "→ "}
                              </span>
                              {signedPercent(value.percent)}
                            </span>
                          }
                        >
                          <p>
                            {value.asOf
                              ? `Reported ${date(value.asOf)}`
                              : "Reporting date unavailable."}
                          </p>
                        </InfoPopover>
                      ) : (
                        <InfoPopover
                          label={`Why ${period} is missing for ${a.name}`}
                          trigger="—"
                        >
                          <p>
                            {a.returns.status === "error"
                              ? a.returns.message
                              : `No exact ${period} return is supplied for this account.`}
                          </p>
                        </InfoPopover>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </StatCard>
  );
}
