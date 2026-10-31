import { Money } from "@/components/shared/Money";
import { InfoPopover } from "@/components/shared/InfoPopover";
import type { AccountData, ExchangeRate, Result } from "@/lib/types";
import {
  portfolioCurrencyTotals,
  combinedUsd,
} from "@/lib/accounts/currency-totals";
import styles from "./Accounts.module.css";
export function CurrencyTotal({
  accounts,
  rate,
}: {
  accounts: AccountData[];
  rate: Result<ExchangeRate>;
}) {
  const totals = portfolioCurrencyTotals(accounts);
  const converted =
    rate.status === "ok" ? combinedUsd(totals, rate.data.cadPerUsd) : null;
  const partial = totals.incomplete || totals.otherCurrencies.length > 0;
  return (
    <section
      className={`${styles.card} ${styles.summary}`}
      aria-label="Combined CAD and USD estimate"
    >
      <div className={styles.cardHeading}>
        <h2>Combined CAD + USD value</h2>
        <InfoPopover label="Exchange rate and conversion information">
          <strong>Estimated from holdings + cash</strong>
          <p>
            USD subtotal + CAD subtotal ÷ CAD per USD. Includes short positions
            and may differ from brokerage-reported totals.
          </p>
          {rate.status === "ok" ? (
            <>
              <p>
                1 CAD = {(1 / rate.data.cadPerUsd).toFixed(6)} USD
                <br />1 USD = {rate.data.cadPerUsd.toFixed(6)} CAD
              </p>
              <p>
                <a
                  href="https://www.bankofcanada.ca/rates/exchange/daily-exchange-rates/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Bank of Canada daily reference
                </a>{" "}
                · {rate.data.asOf}
              </p>
              <p>
                Latest published business-day rate, not a live Wealthsimple
                quote. Fees and spreads excluded.
              </p>
            </>
          ) : (
            <p>{rate.message}</p>
          )}
          {totals.incomplete && (
            <p>
              Some cash, holdings, valuations, or sync data are incomplete.
              Available estimates may understate or overstate account values.
            </p>
          )}
          {totals.otherCurrencies.length > 0 && (
            <p>
              Excludes other currencies: {totals.otherCurrencies.join(", ")}.
            </p>
          )}
        </InfoPopover>
      </div>
      <div className={styles.summaryGrid}>
        <div>
          <span className={styles.label}>
            {partial ? "Partial estimate in USD" : "Estimated total in USD"}
          </span>
          <strong className={styles.combinedValue}>
            <Money value={{ amount: converted, currency: "USD" }} />
          </strong>
          <small>Estimated from holdings + cash</small>
        </div>
        <dl className={styles.subtotals}>
          <div>
            <dt>CAD subtotal</dt>
            <dd>
              <Money value={{ amount: totals.cad, currency: "CAD" }} />
            </dd>
          </div>
          <div>
            <dt>USD subtotal</dt>
            <dd>
              <Money value={{ amount: totals.usd, currency: "USD" }} />
            </dd>
          </div>
        </dl>
      </div>
      <p className={styles.footnote}>
        {rate.status === "error"
          ? "Conversion unavailable. "
          : "Reference-rate estimate. "}
        {partial ? "Partial or stale data; " : ""}Reported brokerage totals
        appear below.
      </p>
    </section>
  );
}
