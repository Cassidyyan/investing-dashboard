import { Select } from "@/components/shared/Select";
import { InfoPopover } from "@/components/shared/InfoPopover";
import {
  OPTIONS_CURRENCY,
  OPTIONS_CURRENCY_NOTE,
} from "@/lib/options/currency";
import type {
  OptionsData,
  OptionsFilters as Filters,
} from "@/lib/options/analytics-types";
import styles from "./OptionsAnalytics.module.css";
export function OptionsFilters({
  data,
  value,
  onChange,
}: {
  data: OptionsData;
  value: Filters;
  onChange: (value: Filters) => void;
}) {
  const change = (key: keyof Filters, next: string) =>
    onChange({ ...value, [key]: next });
  return (
    <section className={styles.filters} aria-label="Options analytics filters">
      <label>
        Account
        <Select
          value={value.account}
          onChange={(e) => change("account", e.target.value)}
        >
          <option value="all">All investing accounts</option>
          {data.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </label>
      <label>
        Underlying
        <Select
          value={value.ticker}
          aria-label="Underlying"
          onChange={(e) => change("ticker", e.target.value)}
        >
          <option value="all">All tickers</option>
          {[...new Set(data.trades.map((t) => t.ticker))].sort().map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
      </label>
      <label>
        Contract
        <Select
          value={value.right}
          onChange={(e) => change("right", e.target.value)}
        >
          <option value="all">Puts & calls</option>
          <option value="PUT">Puts</option>
          <option value="CALL">Calls</option>
        </Select>
      </label>
      <label>
        Lifecycle status
        <Select
          value={value.status}
          onChange={(e) => change("status", e.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="closed">Closed</option>
          <option value="open">Open</option>
          <option value="partial">Partially closed</option>
          <option value="needs-review">Needs review</option>
        </Select>
      </label>
      <label>
        From
        <input
          type="date"
          value={value.from}
          max={value.to || undefined}
          onChange={(e) => change("from", e.target.value)}
        />
      </label>
      <label>
        Through
        <input
          type="date"
          value={value.to}
          min={value.from || undefined}
          onChange={(e) => change("to", e.target.value)}
        />
      </label>
      <div className={styles.currencyControl}>
        <span className={styles.currencyLabel}>Currency</span>
        <InfoPopover
          label="Options currency: USD Assumed"
          trigger={
            <span className={styles.currencyPill}>
              <strong>{OPTIONS_CURRENCY}</strong>{" "}
              <span className={styles.currencyAssumption}>Assumed</span>
              <svg
                width="15"
                height="15"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <circle cx="10" cy="10" r="7.5" />
                <path d="M10 9v5" />
                <circle
                  cx="10"
                  cy="6"
                  r=".7"
                  fill="currentColor"
                  stroke="none"
                />
              </svg>
            </span>
          }
        >
          <p>
            <strong>USD for all options</strong>
          </p>
          <p>{OPTIONS_CURRENCY_NOTE}</p>
        </InfoPopover>
      </div>
      <div className={styles.filterFooter}>
        <p>
          Realized P&amp;L uses realization dates; completed-trade stats use
          final close dates. Premiums and journal use activity dates.
        </p>
        <button
          type="button"
          onClick={() =>
            onChange({
              account: "all",
              ticker: "all",
              currency: OPTIONS_CURRENCY,
              from: "",
              to: "",
              right: "all",
              status: "all",
            })
          }
        >
          Reset filters
        </button>
      </div>
    </section>
  );
}
