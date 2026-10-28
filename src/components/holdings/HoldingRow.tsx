import { useId } from "react";
import type { AccountData, ExchangeRate, Money, Result } from "@/lib/types";
import {
  displayCurrency,
  holdingColor,
  holdingKey,
  selectedValue,
  type HoldingEntry,
  type HoldingsCurrency,
} from "@/lib/holdings/holdings-view";
import { isOption } from "@/lib/holdings/holdings";
import { date, money, quantity } from "@/lib/format";
import { SecurityIcon } from "@/components/shared/SecurityIcon";
import {
  PrivateValue,
  useBalancePrivacy,
} from "@/components/shared/BalancePrivacy";
import { InfoPopover } from "@/components/shared/InfoPopover";
import { MoneyValue } from "@/components/shared/MoneyValue";
import { ChangeBadge } from "@/components/shared/ChangeBadge";
import { OptionCard } from "@/components/options/OptionsDetails";
import styles from "./Holdings.module.css";
import shared from "@/styles/dashboard.module.css";
export const positionType = (kind: string) =>
  ({
    stock: "Stock",
    adr: "ADR",
    etf: "ETF",
    cef: "Fund",
    mutualfund: "Fund",
    option: "Option",
    future_option: "Futures option",
    crypto: "Crypto",
    other: "Other",
  })[kind] || kind;
export function HoldingRow({
  entry,
  mode,
  rate,
  total,
  accounts,
}: {
  entry: HoldingEntry;
  mode: HoldingsCurrency;
  rate: Result<ExchangeRate>;
  total: number | null;
  accounts: AccountData[];
}) {
  const { hidden } = useBalancePrivacy();
  const id = useId(),
    p = entry.position;
  const value = selectedValue(p, mode, rate),
    weight =
      value !== null && value > 0 && total !== null && total > 0
        ? (value / total) * 100
        : null;
  const renderMoney = (m: Money | undefined) => (
    <PrivateValue placeholder="••••">
      {m ? money(m) : "Unavailable"}
    </PrivateValue>
  );
  return (
    <tbody className={styles.rowGroup}>
      <tr className={styles.holdingRow}>
        <td>
          <div className={styles.security}>
            <SecurityIcon symbol={p.symbol} logoUrl={entry.logoUrl ?? null} />
            <div className={styles.securityCopy}>
              <strong title={p.symbol}>{p.symbol}</strong>
              {p.description && (
                <small title={p.description}>{p.description}</small>
              )}
              <span className={styles.typeBadge}>{positionType(p.kind)}</span>
            </div>
          </div>
        </td>
        <td className={styles.numeric}>
          <span className={styles.mobileLabel}>Value</span>
          <b>
            <MoneyValue amount={value} currency={displayCurrency(mode)} />
          </b>
          <small>
            {mode === "COMBINED_USD" && p.value.currency === "CAD"
              ? "Estimated in USD"
              : "Position value"}
          </small>
        </td>
        <td className={styles.numeric}>
          <span className={styles.mobileLabel}>Weight</span>
          <span>
            {weight === null ? "Unavailable" : `${weight.toFixed(1)}%`}
          </span>
          {weight !== null && (
            <div
              className={`${styles.weightTrack} ${hidden ? shared.blurred : ""}`}
              aria-hidden="true"
            >
              <span
                style={{
                  width: `${Math.min(100, weight)}%`,
                  background: holdingColor(holdingKey(p.symbol, p.kind)),
                }}
              />
            </div>
          )}
        </td>
        <td>
          <span className={styles.mobileLabel}>Account</span>
          <InfoPopover
            label={`Account information for ${entry.account.name}`}
            trigger={entry.account.name}
            align="start"
          >
            <p>
              {entry.account.institution} · {entry.account.suffix}
            </p>
            <p>
              Reported total: {renderMoney(entry.account.value)}. This brokerage
              total may include cash and short positions; it is not the
              estimated holdings value shown here.
            </p>
            <p>Account sync: {date(entry.account.syncedAt)} ET.</p>
          </InfoPopover>
          <span className={styles.typeBadge}>{entry.account.type}</span>
        </td>
      </tr>
      <tr className={styles.detailRow}>
        <td colSpan={4}>
          <details className={styles.positionDetails}>
            <summary aria-controls={id}>
              Position details <span aria-hidden="true">⌄</span>
            </summary>
            <div id={id} className={styles.detailsBody}>
              <dl className={styles.facts}>
                <div>
                  <dt>Quantity</dt>
                  <dd>
                    <PrivateValue placeholder="••••">
                      {quantity(p.units)}
                    </PrivateValue>
                  </dd>
                </div>
                <div>
                  <dt>Last price · native</dt>
                  <dd>{renderMoney(p.price)}</dd>
                </div>
                <div>
                  <dt>Currency</dt>
                  <dd>{p.value.currency || "Unavailable"}</dd>
                </div>
                <div>
                  <dt>Average cost · native</dt>
                  <dd>{renderMoney(p.averageCost)}</dd>
                </div>
                <div>
                  <dt>Market value · native</dt>
                  <dd>{renderMoney(p.value)}</dd>
                </div>
                <div>
                  <dt>Net return · unrealized</dt>
                  <dd>
                    <ChangeBadge
                      change={
                        p.unrealizedReturn?.amount != null
                          ? {
                              amount: p.unrealizedReturn.amount,
                              percent: p.unrealizedReturnPercent,
                            }
                          : null
                      }
                      currency={
                        p.unrealizedReturn?.currency ||
                        p.value.currency ||
                        "USD"
                      }
                      showPercentWhenHidden
                    />
                  </dd>
                </div>
              </dl>
              <p className={styles.footnote}>
                Reported prices/costs and the existing position-value
                calculation. Unrealized return is not lifetime performance;
                separate dividends, realized gains, fees, taxes and FX
                adjustments are excluded.
              </p>
              {isOption(p.kind) && (
                <div className={styles.optionDetails}>
                  <OptionCard position={p} accounts={accounts} />
                </div>
              )}
            </div>
          </details>
        </td>
      </tr>
    </tbody>
  );
}
