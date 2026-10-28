import type { AccountData, ExchangeRate, Result } from "@/lib/types";
import {
  allocationView,
  displayCurrency,
  flattenHoldings,
  inCurrency,
  type HoldingsCurrency,
} from "@/lib/holdings-view";
import { StatCard } from "@/components/overview/StatCard";
import { OverviewMoney } from "@/components/overview/OverviewMoney";
import { CurrencyToggle } from "@/components/shared/CurrencyToggle";
import { InfoPopover } from "@/components/shared/InfoPopover";
import styles from "./Holdings.module.css";
export function SummaryStrip({
  accounts,
  mode,
  onMode,
  rate,
}: {
  accounts: AccountData[];
  mode: HoldingsCurrency;
  onMode: (mode: HoldingsCurrency) => void;
  rate: Result<ExchangeRate>;
}) {
  const allocation = allocationView(accounts, mode, "holding", rate);
  const positions = flattenHoldings(accounts).filter(
    (e) => e.position.units !== 0 && inCurrency(e.position, mode),
  );
  const concentration =
    allocation.total !== null && allocation.total > 0
      ? allocation.items.slice(0, 3).reduce((sum, r) => sum + r.percent, 0)
      : null;
  return (
    <div className={styles.summaryStrip}>
      <StatCard
        title="Total holdings value"
        className={styles.valueTile}
        action={
          <InfoPopover label="Holdings value, currencies and exchange-rate information">
            <p>
              Estimated holdings value is the sum of available positive position
              values in the selected currency scope, using the existing
              holdings-allocation calculation. Options are included when their
              reported multiplier and price support valuation. Negative, zero
              and missing values are excluded from allocation, not deleted from
              brokerage data.
            </p>
            <p>
              Reported total is the brokerage’s account-level value, which can
              include cash and short positions and use a different snapshot.
              This strip is not that total or net liquidation value.
            </p>
            {rate.status === "ok" ? (
              <p>
                Combined est. USD = USD holdings + CAD holdings ÷{" "}
                {rate.data.cadPerUsd.toFixed(6)}. Bank of Canada daily reference
                · {rate.data.asOf}. Fees/spreads excluded. Native CAD and USD
                views do not convert.
              </p>
            ) : (
              <p>
                Exchange rate unavailable. Combined estimated USD cannot include
                CAD; use native CAD or USD.
              </p>
            )}
          </InfoPopover>
        }
      >
        <CurrencyToggle
          value={mode}
          onChange={onMode}
          includeCombined
          label="Holdings display currency"
        />
        <p className={styles.summaryValue}>
          <OverviewMoney
            amount={allocation.total}
            currency={displayCurrency(mode)}
          />
        </p>
        <p className={styles.footnote}>
          Estimated holdings value · positive positions
        </p>
      </StatCard>
      <StatCard title="Positions" className={styles.smallTile}>
        <p className={styles.summaryValue}>{positions.length}</p>
        <p className={styles.footnote}>
          Across {accounts.length} selected{" "}
          {accounts.length === 1 ? "account" : "accounts"}
        </p>
        {allocation.failedAccounts > 0 && (
          <p className={styles.footnote}>
            Partial count · {allocation.failedAccounts} unavailable
          </p>
        )}
      </StatCard>
      <StatCard title="Concentration" className={styles.smallTile}>
        <p className={styles.summaryValue}>
          {concentration === null
            ? "Unavailable"
            : `${concentration.toFixed(1)}%`}
        </p>
        <p className={styles.footnote}>
          Top 3 holdings · selected positive value
        </p>
      </StatCard>
    </div>
  );
}
