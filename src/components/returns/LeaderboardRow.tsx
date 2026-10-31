"use client";
import { useId, useState } from "react";
import type { HoldingReturn } from "@/lib/returns/holding-returns";
import { isFxEstimate } from "@/lib/returns/presentation";
import { SecurityIcon } from "@/components/shared/SecurityIcon";
import { InfoPopover } from "@/components/shared/InfoPopover";
import { PrivateValue } from "@/components/shared/BalancePrivacy";
import { quantity } from "@/lib/format";
import { ReturnAmount, ReturnPercent } from "./ReturnValue";
import { ProfitBar } from "./ProfitBar";
import styles from "./Returns.module.css";
export function LeaderboardRow({
  row,
  rank,
  max,
  name,
}: {
  row: HoldingReturn;
  rank: number;
  max: number;
  name?: string;
}) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  return (
    <tbody className={styles.rowGroup}>
      <tr className={styles.holdingRow}>
        <td>
          <div className={styles.security}>
            <span className={styles.rank}>{rank}</span>
            <SecurityIcon symbol={row.symbol} logoUrl={row.logoUrl ?? null} />
            <div className={styles.securityCopy}>
              <div className={styles.securityHeadline}>
                <strong>{row.symbol}</strong>
                <InfoPopover
                  label={`Accounts for ${row.symbol}`}
                  trigger={`${row.accounts.length} ${row.accounts.length === 1 ? "account" : "accounts"}`}
                  badge
                >
                  <p>{row.accounts.join(" · ") || "Unavailable"}</p>
                </InfoPopover>
                {isFxEstimate(row) && (
                  <InfoPopover
                    label={`Historical FX estimate for ${row.symbol}`}
                    trigger="FX est."
                    badge
                  >
                    {row.notes
                      ?.filter((n) => n.startsWith("Historical FX estimate"))
                      .map((n) => (
                        <p key={n}>{n}</p>
                      ))}
                  </InfoPopover>
                )}
              </div>
              <small title={name || undefined}>{name || "\u00a0"}</small>
            </div>
          </div>
        </td>
        <td className={styles.numeric}>
          <span className={styles.mobileLabel}>Total profit</span>
          <ReturnAmount value={row.totalProfit} currency={row.currency} />
          <ProfitBar value={row.totalProfit ?? 0} max={max} />
        </td>
        <td className={styles.numeric}>
          <span className={styles.mobileLabel}>Return %</span>
          <ReturnPercent value={row.returnPercent} />
        </td>
        <td className={`${styles.numeric} ${styles.secondaryCell}`}>
          <div>
            <small title="Realized">R</small>
            <ReturnAmount value={row.realized} currency={row.currency} />
          </div>
          <div>
            <small title="Unrealized">U</small>
            <ReturnAmount value={row.unrealized} currency={row.currency} />
          </div>
        </td>
        <td className={`${styles.numeric} ${styles.secondaryCell}`}>
          <span className={styles.mobileLabel}>Dividends</span>
          <ReturnAmount value={row.dividends} currency={row.currency} />
        </td>
        <td>
          <button
            type="button"
            className={styles.expandButton}
            aria-label={`Holding details for ${row.symbol}`}
            aria-expanded={expanded}
            aria-controls={id}
            onClick={() => setExpanded(!expanded)}
          >
            ⌄
          </button>
        </td>
      </tr>
      <tr className={styles.detailRow} hidden={!expanded}>
        <td colSpan={6}>
          <div className={styles.rowDetails}>
            <h3 className={styles.srOnly}>Holding details</h3>
            <div className={styles.detailBody} id={id}>
              <dl className={styles.facts}>
                <div>
                  <dt>Accounts · combined holding</dt>
                  <dd>{row.accounts.join(" · ") || "Unavailable"}</dd>
                </div>
                {row.firstPurchase && (
                  <div>
                    <dt>First recorded buy date</dt>
                    <dd>{row.firstPurchase}</dd>
                  </div>
                )}
                <div>
                  <dt>Realized</dt>
                  <dd>
                    <ReturnAmount
                      value={row.realized}
                      currency={row.currency}
                    />
                  </dd>
                </div>
                <div>
                  <dt>Unrealized</dt>
                  <dd>
                    <ReturnAmount
                      value={row.unrealized}
                      currency={row.currency}
                    />
                  </dd>
                </div>
                <div>
                  <dt>Dividends</dt>
                  <dd>
                    <ReturnAmount
                      value={row.dividends}
                      currency={row.currency}
                    />
                  </dd>
                </div>
                <div>
                  <dt>Charges / refunds · profit impact</dt>
                  <dd>
                    <ReturnAmount
                      value={-row.charges}
                      currency={row.currency}
                    />
                  </dd>
                </div>
              </dl>
              <h3>Sales history</h3>
              <p className={styles.caption}>
                {row.sales.filter((s) => s.profit > 0).length} profitable /{" "}
                {row.sales.length} sales
              </p>
              {row.sales.length ? (
                <ul className={styles.sales}>
                  {[...row.sales]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((sale, i) => (
                      <li key={`${sale.date}-${i}`}>
                        <span>
                          {sale.date} ·{" "}
                          <PrivateValue placeholder="••••">
                            {quantity(sale.units)}
                          </PrivateValue>{" "}
                          shares
                        </span>
                        <ReturnAmount
                          value={sale.profit}
                          currency={row.currency}
                        />
                      </li>
                    ))}
                </ul>
              ) : (
                <p className={styles.caption}>No recorded sales.</p>
              )}
              {!!row.notes?.length && (
                <>
                  <h3>Calculation notes</h3>
                  <ul>
                    {[...new Set(row.notes)].map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </td>
      </tr>
    </tbody>
  );
}
