import type { HoldingReturn } from "@/lib/returns/holding-returns";
import { StatCard } from "@/components/shared/StatCard";
import { SecurityIcon } from "@/components/shared/SecurityIcon";
import { ReturnAmount } from "./ReturnValue";
import styles from "./Returns.module.css";
export function BestWorstCards({
  rows,
  currency,
  names,
}: {
  rows: HoldingReturn[];
  currency: string;
  names: Record<string, string>;
}) {
  if (!rows.length) return null;
  const sorted = [...rows].sort(
    (a, b) =>
      b.totalProfit! - a.totalProfit! || a.symbol.localeCompare(b.symbol),
  );
  return (
    <div className={styles.bestWorst}>
      {[
        { title: "Best holding", row: sorted[0] },
        { title: "Worst holding", row: sorted.at(-1)! },
      ].map(({ title, row }) => {
        return (
          <StatCard key={title} title={title}>
            <div className={styles.security}>
              <SecurityIcon symbol={row.symbol} logoUrl={row.logoUrl ?? null} />
              <div>
                <h3>{row.symbol}</h3>
                {names[row.symbol] && <small>{names[row.symbol]}</small>}
              </div>
            </div>
            <p className={styles.winnerValue}>
              <ReturnAmount
                value={row.totalProfit}
                percent={row.returnPercent}
                currency={currency}
                showCurrency
              />
            </p>
            <p className={styles.caption}>
              {title === "Best holding"
                ? row.totalProfit! > 0
                  ? "Largest gain among ranked holdings"
                  : "Highest profit among ranked holdings; no positive gain"
                : row.totalProfit! < 0
                  ? "Largest loss among ranked holdings"
                  : "Lowest profit among ranked holdings; no loss"}
            </p>
          </StatCard>
        );
      })}
    </div>
  );
}
