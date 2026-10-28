import { PrivateValue } from "@/components/shared/BalancePrivacy";
import type { AccountData, PositionView } from "@/lib/types";
import { isOption } from "@/lib/holdings";
import {
  daysToExpiration,
  findUnderlyingPrice,
  formatExpiration,
  moneyness,
} from "@/lib/option-details";
import {
  date,
  money,
  quantity,
  signedMoney,
  signedPercent,
} from "@/lib/format";
import { SectionState } from "@/components/shared/SectionState";

export function OptionCard({
  position,
  accounts,
}: {
  position: PositionView;
  accounts: AccountData[];
}) {
  const option = position.optionDetails;
  const days = daysToExpiration(option?.expiration);
  const underlying = findUnderlyingPrice(position, accounts);
  const status = moneyness(
    option?.type,
    option?.strike.amount,
    underlying?.price.amount,
    days,
  );
  const direction =
    position.units !== null &&
    Number.isFinite(position.units) &&
    position.units !== 0
      ? position.units < 0
        ? "Short"
        : "Long"
      : null;
  const moneynessTone =
    status === "At the money"
      ? "moneyness-atm"
      : direction &&
          (status === "In the money" || status === "Out of the money")
        ? (direction === "Long") === (status === "In the money")
          ? "moneyness-green"
          : "moneyness-red"
        : "";
  const remaining =
    days === null
      ? "Expiry unknown"
      : days < 0
        ? "Expired"
        : days === 0
          ? "Expires today"
          : `${days} days left`;
  const unavailable = { amount: null, currency: position.price.currency };
  return (
    <details className="option-card">
      <summary>
        <span className="option-contract-heading">
          <b>{option?.underlyingSymbol || position.symbol}</b>
          <span className="badge">
            {direction ? `${direction} ` : ""}
            {option?.type || "Option"}
          </span>
          <small>
            <PrivateValue placeholder="••••">
              {option ? money(option.strike) : "Strike unavailable"}
            </PrivateValue>{" "}
            · {formatExpiration(option?.expiration)}
          </small>
        </span>
        <span className={`badge moneyness-badge ${moneynessTone}`}>
          {status}
        </span>
        <span className="option-days">{remaining}</span>
      </summary>
      <div className="option-card-body">
        <p className="muted option-symbol">
          {position.symbol}
          {position.description ? ` · ${position.description}` : ""}
        </p>
        <dl className="option-facts">
          <div>
            <dt>Strike</dt>
            <dd>
              <PrivateValue placeholder="••••">
                {money(option?.strike ?? unavailable)}
              </PrivateValue>
            </dd>
          </div>
          <div>
            <dt>Expiration date</dt>
            <dd>{formatExpiration(option?.expiration)}</dd>
          </div>
          <div>
            <dt>Days to expiration</dt>
            <dd>
              {days === null
                ? "Unavailable"
                : days < 0
                  ? `${Math.abs(days)} days past`
                  : days}
            </dd>
          </div>
          <div>
            <dt>Contracts / direction</dt>
            <dd>
              <PrivateValue placeholder="••••">
                {quantity(position.units)}
              </PrivateValue>
              <small>
                {position.units === null
                  ? "Unknown direction"
                  : position.units < 0
                    ? "Short"
                    : "Long"}
              </small>
            </dd>
          </div>
          <div>
            <dt>Contract multiplier</dt>
            <dd>
              <PrivateValue placeholder="••••">
                {quantity(option?.multiplier ?? null)}
              </PrivateValue>
            </dd>
          </div>
          <div>
            <dt>Last premium / unit</dt>
            <dd>
              <PrivateValue placeholder="••••">
                {money(position.price)}
              </PrivateValue>
            </dd>
          </div>
          <div>
            <dt>Average premium / unit</dt>
            <dd>
              <PrivateValue placeholder="••••">
                {money(position.averageCost ?? unavailable)}
              </PrivateValue>
            </dd>
          </div>
          <div>
            <dt>Estimated market value</dt>
            <dd>
              <PrivateValue placeholder="••••">
                {money(position.value)}
              </PrivateValue>
            </dd>
          </div>
          <div>
            <dt>Unrealized return</dt>
            <dd>
              <PrivateValue placeholder="••••">
                {signedMoney(position.unrealizedReturn ?? unavailable)}
              </PrivateValue>
              <small>{signedPercent(position.unrealizedReturnPercent)}</small>
            </dd>
          </div>
          <div>
            <dt>Underlying snapshot price</dt>
            <dd>
              <PrivateValue placeholder="••••">
                {money(underlying?.price ?? unavailable)}
              </PrivateValue>
            </dd>
          </div>
          <div>
            <dt>Moneyness</dt>
            <dd>
              <span className={`badge moneyness-badge ${moneynessTone}`}>
                {status}
              </span>
            </dd>
          </div>
        </dl>
        {underlying ? (
          <p className="muted">
            Underlying price from an existing held position, as of{" "}
            {date(underlying.asOf)}. This may be delayed and is not a live
            quote.
          </p>
        ) : (
          <p className="muted">
            Moneyness needs a recent matching underlying price in the same
            currency. No suitable held-position price is available.
          </p>
        )}
        <details className="option-risk">
          <summary>
            Greeks &amp; implied volatility{" "}
            <span className="badge">Market data required</span>
          </summary>
          <p className="muted">
            An options market-data provider is not connected. These values are
            unavailable rather than estimated.
          </p>
          <dl className="option-facts">
            {[
              "Delta",
              "Gamma",
              "Theta",
              "Vega",
              "Rho",
              "Implied volatility (IV)",
            ].map((label) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>Unavailable</dd>
              </div>
            ))}
          </dl>
        </details>
      </div>
    </details>
  );
}
export function OptionsDetails({ accounts }: { accounts: AccountData[] }) {
  const rows = accounts.filter(
    (a) =>
      a.positions.status === "error" ||
      a.positions.data.rows.some((p) => isOption(p.kind) && p.units !== 0),
  );
  if (!rows.length)
    return <p className="empty">No current option positions available.</p>;
  return (
    <div className="options-section">
      <h3>Option contract details</h3>
      <p className="muted">
        Expand an account and contract to inspect it. Days remaining are
        calendar days in America/Toronto, not the exact trading cutoff. “At the
        money” means within 0.5% of strike. Moneyness describes the contract,
        not whether your position is profitable.
      </p>
      {rows.map((a) => (
        <details
          key={a.account.id}
          className="account-section account-disclosure"
        >
          <summary>
            <span>
              {a.account.name}
              <small>{a.account.suffix}</small>
            </span>
            <span className="badge">
              {a.positions.status === "ok"
                ? `${a.positions.data.rows.filter((p) => isOption(p.kind) && p.units !== 0).length} positions`
                : "Unavailable"}
            </span>
          </summary>
          <SectionState result={a.positions}>
            {(positions) => (
              <>
                <p className="muted">
                  Position data as of {date(positions.asOf)}
                </p>
                {positions.rows
                  .filter((p) => isOption(p.kind) && p.units !== 0)
                  .map((p, i) => (
                    <OptionCard
                      key={`${p.symbol}-${i}`}
                      position={p}
                      accounts={accounts}
                    />
                  ))}
              </>
            )}
          </SectionState>
        </details>
      ))}
      <p className="muted">
        Premiums are per share/unit; market values and unrealized return include
        the reported multiplier when supported. Returns exclude separate
        adjustments for realized gains, dividends, fees, taxes, and FX. No
        Greeks or IV are derived from position prices.
      </p>
    </div>
  );
}
