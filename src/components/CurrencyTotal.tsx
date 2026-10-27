import type { AccountData, ExchangeRate, Result } from "@/lib/types";
import { portfolioCurrencyTotals, combinedUsd } from "@/lib/currency-totals";
import { money } from "@/lib/format";
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
  return (
    <section className="panel currency-total">
      <h2>Combined CAD + USD value</h2>
      <p className="muted">
        Estimated cash plus holdings across the accounts above, including short
        positions. These estimates may differ from brokerage-reported totals.
      </p>
      <div className="currency-subtotals">
        <div>
          <small>CAD subtotal</small>
          <strong>{money({ amount: totals.cad, currency: "CAD" })}</strong>
        </div>
        <span aria-hidden="true">+</span>
        <div>
          <small>USD subtotal</small>
          <strong>{money({ amount: totals.usd, currency: "USD" })}</strong>
        </div>
      </div>
      {totals.incomplete && (
        <p className="notice">
          Partial or stale estimate: some cash, holdings, or valuations are
          unavailable. Available subtotals may understate or overstate the
          account values.
        </p>
      )}
      {totals.otherCurrencies.length > 0 && (
        <p className="notice">
          Excludes other currencies: {totals.otherCurrencies.join(", ")}.
        </p>
      )}
      <div className="converted-total">
        <small>
          {totals.incomplete || totals.otherCurrencies.length
            ? "Partial estimated total in USD"
            : "Estimated total in USD"}
        </small>
        <strong>{money({ amount: converted, currency: "USD" })}</strong>
      </div>
      {rate.status === "ok" ? (
        <>
          <p className="muted data-text">
            1 CAD = {(1 / rate.data.cadPerUsd).toFixed(6)} USD · 1 USD ={" "}
            {rate.data.cadPerUsd.toFixed(6)} CAD
          </p>
          <p className="muted">
            USD subtotal + CAD subtotal ÷ {rate.data.cadPerUsd}.{" "}
            <a
              href="https://www.bankofcanada.ca/rates/exchange/daily-exchange-rates/"
              target="_blank"
              rel="noreferrer"
            >
              Bank of Canada daily average
            </a>{" "}
            · {rate.data.asOf}. Latest published business-day reference rate;
            not a live Wealthsimple quote. Conversion fees and spreads are
            excluded.
          </p>
        </>
      ) : (
        <p className="notice" role="status">
          {rate.message}
        </p>
      )}
    </section>
  );
}
