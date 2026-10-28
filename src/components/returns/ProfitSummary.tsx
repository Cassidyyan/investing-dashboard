import type { HoldingReturn } from "@/lib/returns/holding-returns";
import { sumReturns } from "@/lib/returns/presentation";
import { StatCard } from "@/components/shared/StatCard";
import { CurrencyToggle } from "@/components/shared/CurrencyToggle";
import { InfoPopover } from "@/components/shared/InfoPopover";
import { ReturnAmount } from "./ReturnValue";
import { ProfitBar, type ProfitPart } from "./ProfitBar";
import styles from "./Returns.module.css";
export function ProfitSummary({
  rows,
  currency,
  onCurrency,
  otherCurrencies,
}: {
  rows: HoldingReturn[];
  currency: string;
  onCurrency: (value: string) => void;
  otherCurrencies: string[];
}) {
  const realized = sumReturns(rows, "realized"),
    unrealized = sumReturns(rows, "unrealized"),
    dividends = sumReturns(rows, "dividends"),
    charges = sumReturns(rows, "charges");
  const parts: ProfitPart[] = [];
  for (const [label, value] of [
    ["Realized", realized],
    ["Unrealized", unrealized],
    ["Dividends", dividends],
  ] as const)
    if (value !== null) parts.push({ label, value });
  if (charges) parts.push({ label: "Charges", value: -charges });
  return (
    <section aria-label="Ranked holding profit summary">
      <div className={styles.summaryTools}>
        <span>Native amounts · {currency}</span>
        <div className={styles.currencyTools}>
          <CurrencyToggle
            value={currency as "CAD" | "USD"}
            onChange={onCurrency}
            label="Returns currency"
          />
          {otherCurrencies.map((c) => (
            <button
              type="button"
              key={c}
              aria-pressed={currency === c}
              onClick={() => onCurrency(c)}
            >
              {c}
            </button>
          ))}
          <InfoPopover label="Currency and historical exchange-rate source">
            <p>
              Currency selection shows separate native-currency holdings; it
              does not convert or combine totals. Historical settlement
              conversions already calculated by the server use Bank of Canada
              daily reference rates, on or before each transaction date, up to
              seven days earlier. Each holding’s FX notes contain available
              details. There is no single exchange rate for all dates; brokerage
              spreads and rates may differ.
            </p>
            <a
              href="https://www.bankofcanada.ca/rates/exchange/daily-exchange-rates/"
              target="_blank"
              rel="noreferrer"
            >
              Bank of Canada rate source ↗
            </a>
          </InfoPopover>
        </div>
      </div>
      <div className={styles.summaryTiles}>
        {(
          [
            ["Total profit", sumReturns(rows, "totalProfit")],
            ["Realized", realized],
            ["Unrealized", unrealized],
            ["Dividends", dividends],
          ] as const
        ).map(([title, value]) => (
          <StatCard title={title} key={title}>
            <p className={styles.summaryValue}>
              <ReturnAmount value={value} currency={currency} showCurrency />
            </p>
            <p className={styles.caption}>Ranked holdings · {currency}</p>
          </StatCard>
        ))}
      </div>
      {!!parts.length && (
        <div className={styles.breakdown}>
          <ProfitBar parts={parts} />
          <dl>
            {parts.map((p) => (
              <div key={p.label}>
                <dt>{p.label}</dt>
                <dd>
                  <ReturnAmount value={p.value} currency={currency} />
                </dd>
              </div>
            ))}
          </dl>
          <p className={styles.caption}>
            Profit components · negative values extend left of zero
            {charges
              ? charges > 0
                ? " · charges reduce total profit"
                : " · refunds increase total profit"
              : ""}
            .
          </p>
        </div>
      )}
    </section>
  );
}
