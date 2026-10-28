import { useState } from "react";
import type { AccountData, ExchangeRate, Result } from "@/lib/types";
import {
  allocationView,
  displayCurrency,
  type AllocationMode,
  type HoldingsCurrency,
} from "@/lib/holdings/holdings-view";
import { StatCard } from "@/components/shared/StatCard";
import { CurrencyToggle } from "@/components/shared/CurrencyToggle";
import { InfoPopover } from "@/components/shared/InfoPopover";
import { AllocationDonut } from "./AllocationDonut";
import { AllocationBars } from "./AllocationBars";
import { ExcludedPositionsPopover } from "./ExcludedPositionsPopover";
import styles from "./Holdings.module.css";
export function AllocationCard({
  accounts,
  rate,
  mode,
  onMode,
}: {
  accounts: AccountData[];
  rate: Result<ExchangeRate>;
  mode: HoldingsCurrency;
  onMode: (mode: HoldingsCurrency) => void;
}) {
  const [category, setCategory] = useState<AllocationMode>("holding");
  const data = allocationView(accounts, mode, category, rate);
  return (
    <StatCard
      title="Allocation"
      className={styles.allocationCard}
      action={
        <InfoPopover label="Allocation methodology and scope">
          <p>
            Industry uses the existing positive-equity/fund calculation. It
            excludes cash equivalents, options, crypto and derivatives. Holdings
            and Account use the existing positive-position allocation scope,
            including valued options. No cash-balance request is made on this
            page.
          </p>
          <p>
            Industry labels are app-maintained business groups, not official
            GICS. Funds/ETFs keep their fund categories; their underlying
            holdings are not looked through. Unknown classifications remain
            included as Unclassified.
          </p>
          <p>
            Combined est. USD converts CAD using the existing Bank of Canada
            CAD-per-USD daily reference; USD is unchanged. Native views stay in
            their own currencies.{" "}
            {rate.status === "ok"
              ? `Rate: ${rate.data.cadPerUsd} CAD per USD · ${rate.data.asOf}.`
              : "The rate is unavailable."}{" "}
            Fees/spreads are excluded.
          </p>
          <p>
            All real items are drawn in the donut. The ranked list shows six
            first and can expand inside the card. Zero, negative, missing or
            unsupported values are listed in the exclusions control. Account
            allocation uses holdings values, not brokerage-reported account
            totals. All percentages are shares of the available positive
            allocation.
          </p>
        </InfoPopover>
      }
    >
      <div
        className={styles.segmented}
        role="group"
        aria-label="Allocation grouping"
      >
        {(["industry", "holding", "account"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={category === value}
            onClick={() => setCategory(value)}
          >
            {value[0].toUpperCase() + value.slice(1)}
          </button>
        ))}
      </div>
      <div className={styles.currencyControl}>
        <CurrencyToggle
          value={mode}
          onChange={onMode}
          includeCombined
          label="Allocation currency"
        />
      </div>
      <ExcludedPositionsPopover entries={data.excluded} />
      {data.error ? (
        <p className={styles.empty} role="status">
          {data.error}
        </p>
      ) : !data.items.length ? (
        <p className={styles.empty}>
          No eligible positive positions in this allocation view.
        </p>
      ) : (
        <>
          <AllocationDonut
            items={data.items}
            total={data.total}
            currency={displayCurrency(mode)}
          />
          <AllocationBars
            key={`${category}-${mode}`}
            items={data.items}
            currency={displayCurrency(mode)}
          />
        </>
      )}
      <p className={styles.footnote}>
        {category === "industry"
          ? "Equities & funds only"
          : "Positive position values"}
        {data.failedAccounts
          ? ` · ${data.failedAccounts} accounts unavailable`
          : ""}{" "}
        · Selected accounts
      </p>
    </StatCard>
  );
}
