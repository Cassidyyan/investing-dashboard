import { useId, useState } from "react";
import { useBalancePrivacy } from "@/components/shared/BalancePrivacy";
import {
  convertOverview,
  convertOverviewChange,
  type OverviewModel,
  type OverviewRange,
} from "@/lib/overview/overview";
import { MoneyValue } from "@/components/shared/MoneyValue";
import { ChangeBadge } from "@/components/shared/ChangeBadge";
import { RangeToggle } from "@/components/shared/RangeToggle";
import { CurrencyToggle } from "@/components/shared/CurrencyToggle";
import { NavigationLink } from "@/components/layout/NavigationProgress";
import styles from "@/styles/dashboard.module.css";
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
  const historyCurrency = model.historyByCurrency?.[currency]?.ranges.All.length
    ? currency
    : model.historyByCurrency?.CAD?.ranges.All.length
      ? "CAD"
      : model.historyByCurrency?.USD?.ranges.All.length
        ? "USD"
        : currency;
  const connected = model.historyByCurrency?.[historyCurrency];
  const points =
    connected?.ranges[range] ||
    (model.history?.[range] || []).flatMap((p) => {
      const value = convertOverview(
        { amount: p.value, currency: "CAD" },
        currency,
        model.rate,
      );
      return value === null ? [] : [{ ...p, value }];
    });
  const min = points.length ? Math.min(...points.map((p) => p.value)) : 0;
  const max = points.length ? Math.max(...points.map((p) => p.value)) : 1;
  const firstTime = Date.parse(points[0]?.label || ""),
    lastTime = Date.parse(points.at(-1)?.label || "");
  const coordinates = points.map(
    (p, i) =>
      `${points.length === 1 ? 300 : 8 + (Number.isFinite(firstTime) && lastTime > firstTime ? (Date.parse(p.label) - firstTime) / (lastTime - firstTime) : i / Math.max(1, points.length - 1)) * 584},${max === min ? 72 : 126 - ((p.value - min) / (max - min)) * 106}`,
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
        <MoneyValue amount={total} currency={currency} />
      </p>
      <p className={styles.heroCaption}>
        {partial
          ? "Partial estimate · some values missing or stale"
          : "Investing accounts · reported totals"}
        {model.rate && " · converted where needed"}
      </p>
      <div className={styles.returnStats}>
        <div>
          <span>
            {model.mock && !connected
              ? "Day change"
              : "Latest daily value change"}
          </span>
          <ChangeBadge
            change={
              connected ? connected.dayChange : sampleChange(model.dayChange)
            }
            currency={connected ? historyCurrency : currency}
          />
        </div>
        <div>
          <span>
            {model.mock && !connected
              ? "Total return"
              : "Gain vs recorded net deposits"}
          </span>
          <ChangeBadge
            change={
              connected ? connected.gain : sampleChange(model.totalReturn)
            }
            currency={connected ? historyCurrency : currency}
          />
        </div>
      </div>
      {connected && (
        <p className={styles.footnote}>
          History and statistics in {historyCurrency} · through{" "}
          {connected.asOf || "available snapshots"}. Current reported total
          above is shown in {currency}.
        </p>
      )}
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
                aria-label={`${range} ${historyCurrency} account value history.${model.mock ? " Sample data." : " Estimated daily snapshots; native-currency accounts only."}`}
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
                {points.length > 1 && (
                  <path
                    d={`M${coordinates.join(" L")} L592,144 L8,144 Z`}
                    fill={`url(#${gradient})`}
                  />
                )}
                {points.length === 1 && (
                  <circle cx="300" cy="72" r="4" fill="var(--ov-brand)" />
                )}
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
            <span>Account history unavailable</span>
            <small>
              {model.historyMessage ||
                `No ${historyCurrency} daily snapshots in this date range.`}
            </small>
            <NavigationLink href="/performance">
              View history status
            </NavigationLink>
          </div>
        )}
      </div>
      <div className={styles.chartFooter}>
        <span>
          {connected
            ? `Native ${historyCurrency} history · ${connected.accountCount} / ${connected.totalAccounts} investing accounts`
            : model.mock
              ? "Sample value history"
              : `No ${currency} daily history available`}
        </span>
        <RangeToggle value={range} onChange={setRange} />
      </div>
      {(!model.mock || connected) && (
        <details className={styles.dataAlternative}>
          <summary>History coverage &amp; return methodology</summary>
          <p>
            Historical charts and statistics include only accounts reporting
            daily history in {historyCurrency}. The reported total above
            converts all current investing accounts where possible, so it can
            differ from this native-currency history. No historical values are
            converted with today’s exchange rate.
          </p>
          {connected?.asOf && (
            <p>
              History through {connected.asOf}. Latest value change:{" "}
              {connected.period || "A second snapshot is needed"}. Value change
              includes deposits and withdrawals; it is not investment return.
            </p>
          )}
          <p>
            Gain vs recorded net deposits uses available funding through the
            latest snapshot. It is an estimate, not a verified lifetime return;
            older deposits may be missing.
          </p>
          {connected?.gainMessage && <p>{connected.gainMessage}</p>}
          {!!connected?.missingDates && (
            <p>
              {connected.missingDates} dates excluded because included accounts
              do not all have snapshots.
            </p>
          )}
          {model.historyIssues?.map((message) => (
            <p key={message}>{message}</p>
          ))}
          <p>
            Account value history is a beta source, can have gaps, and its
            schema may change.
          </p>
          <NavigationLink href="/performance">
            Open account performance and funding details
          </NavigationLink>
        </details>
      )}
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
                  <MoneyValue
                    amount={p.value}
                    currency={connected ? historyCurrency : currency}
                  />
                </li>
              ))}
            </ul>
          )}
        </details>
      )}
    </section>
  );
}
