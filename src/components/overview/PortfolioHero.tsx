import { useId, useState } from "react";
import { useBalancePrivacy } from "@/components/shared/BalancePrivacy";
import {
  convertOverview,
  convertOverviewChange,
  type OverviewModel,
  type OverviewRange,
} from "@/lib/overview";
import { OverviewMoney } from "./OverviewMoney";
import { ChangeBadge } from "./ChangeBadge";
import { RangeToggle } from "./RangeToggle";
import { CurrencyToggle } from "@/components/shared/CurrencyToggle";
import styles from "./Overview.module.css";
export function PortfolioHero({
  model,
  currency,
  onCurrency,
  total,
  partial,
}: {
  model: OverviewModel;
  currency: "CAD" | "USD";
  onCurrency: (value: "CAD" | "USD") => void;
  total: number | null;
  partial: boolean;
}) {
  const [range, setRange] = useState<OverviewRange>("1M");
  const { hidden } = useBalancePrivacy();
  const gradient = useId();
  const points = (model.history?.[range] || []).flatMap((p) => {
    const value = convertOverview(
      { amount: p.value, currency: "CAD" },
      currency,
      model.rate,
    );
    return value === null ? [] : [{ ...p, value }];
  });
  const min = points.length ? Math.min(...points.map((p) => p.value)) : 0;
  const max = points.length ? Math.max(...points.map((p) => p.value)) : 1;
  const coordinates = points.map(
    (p, i) =>
      `${8 + (i / Math.max(1, points.length - 1)) * 584},${126 - ((p.value - min) / Math.max(1, max - min)) * 106}`,
  );
  const sampleChange = (change: OverviewModel["dayChange"]) =>
    convertOverviewChange(change, "CAD", currency, model.rate);
  return (
    <section
      className={`${styles.card} ${styles.hero}`}
      aria-label="Portfolio value"
    >
      <div className={styles.cardHeading}>
        <h2>Portfolio value</h2>
        <div className={styles.currencyTools}>
          <CurrencyToggle value={currency} onChange={onCurrency} />
          <details className={styles.rateInfo}>
            <summary aria-label="Exchange rate information">i</summary>
            <div role="note">
              {model.rate ? (
                <>
                  Bank of Canada daily reference rate
                  <br />1 USD = {model.rate.cadPerUsd.toFixed(4)} CAD
                  <br />
                  Published {model.rate.asOf}. Includes no brokerage fees or
                  spread.
                </>
              ) : (
                <>
                  The daily exchange rate is unavailable. Values requiring
                  conversion are omitted and marked partial.
                </>
              )}
            </div>
          </details>
        </div>
      </div>
      <p className={styles.heroValue}>
        <OverviewMoney amount={total} currency={currency} />
      </p>
      <p className={styles.heroCaption}>
        {partial
          ? "Partial estimate · some values missing or stale"
          : "Investing accounts · reported totals"}
        {model.rate && " · converted where needed"}
      </p>
      <div className={styles.returnStats}>
        <div>
          <span>Day change</span>
          <ChangeBadge
            change={sampleChange(model.dayChange)}
            currency={currency}
          />
        </div>
        <div>
          <span>Total return</span>
          <ChangeBadge
            change={sampleChange(model.totalReturn)}
            currency={currency}
          />
        </div>
      </div>
      <div className={styles.heroChart}>
        {points.length ? (
          <>
            <div
              className={hidden ? styles.blurred : ""}
              aria-hidden={hidden || undefined}
            >
              <svg
                viewBox="0 0 600 144"
                preserveAspectRatio="none"
                role="img"
                aria-label={`${range} portfolio value history. Sample data.`}
              >
                <defs>
                  <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="var(--ov-brand)"
                      stopOpacity=".18"
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--ov-brand)"
                      stopOpacity="0"
                    />
                  </linearGradient>
                </defs>
                <path
                  d={`M${coordinates.join(" L")} L592,144 L8,144 Z`}
                  fill={`url(#${gradient})`}
                />
                <path
                  d={`M${coordinates.join(" L")}`}
                  fill="none"
                  stroke="var(--ov-brand)"
                  strokeWidth="2.5"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>
            {hidden && (
              <span className={styles.chartOverlay}>Chart hidden</span>
            )}
          </>
        ) : (
          <div className={styles.chartEmpty}>
            <span>History not connected</span>
            <small>{range} portfolio history is not loaded on this page.</small>
          </div>
        )}
      </div>
      <div className={styles.chartFooter}>
        <span>
          {model.mock
            ? "Sample value history"
            : "Returns & history unavailable in current data"}
        </span>
        <RangeToggle value={range} onChange={setRange} />
      </div>
      {points.length > 0 && (
        <details className={styles.dataAlternative}>
          <summary>Chart data</summary>
          {hidden ? (
            <p>Chart values hidden.</p>
          ) : (
            <ul>
              {points.map((p) => (
                <li key={p.label}>
                  {p.label}:{" "}
                  <OverviewMoney amount={p.value} currency={currency} />
                </li>
              ))}
            </ul>
          )}
        </details>
      )}
    </section>
  );
}
