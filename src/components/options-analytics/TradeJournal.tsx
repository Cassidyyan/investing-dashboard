"use client";
import { Fragment, useState } from "react";
import { StatCard } from "@/components/shared/StatCard";
import { Money } from "@/components/shared/Money";
import { PrivateValue } from "@/components/shared/BalancePrivacy";
import { Select, SortDirectionButton } from "@/components/shared/Select";
import { compareDecimal, decimalNumber } from "@/lib/financial/decimal";
import type {
  AnalyticsTrade,
  OptionsData,
} from "@/lib/options/analytics-types";
import styles from "./OptionsAnalytics.module.css";
const statusLabel = {
  "needs-review": "Needs review",
  partial: "Partially closed",
  closed: "Closed",
  open: "Open",
};
type Sort = "date" | "pnl" | "ticker" | "quantity";
export function TradeJournal({
  trades,
  accounts,
}: {
  trades: AnalyticsTrade[];
  accounts: OptionsData["accounts"];
}) {
  const [search, setSearch] = useState(""),
    [sort, setSort] = useState<Sort>("date"),
    [direction, setDirection] = useState<"ascending" | "descending">(
      "descending",
    ),
    [expanded, setExpanded] = useState<string[]>([]),
    [limit, setLimit] = useState(25);
  const filtered = trades.filter((t) =>
    `${t.ticker} ${t.contract?.symbol || ""} ${accounts.find((a) => a.id === t.accountId)?.name || ""} ${t.status}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const rows = [...filtered].sort((a, b) => {
    if (sort === "pnl") {
      if (a.realizedPnl === null) return b.realizedPnl === null ? 0 : 1;
      if (b.realizedPnl === null) return -1;
      return (
        compareDecimal(a.realizedPnl, b.realizedPnl) *
        (direction === "descending" ? -1 : 1)
      );
    }
    if (sort === "quantity") {
      if (a.openedQuantity === null) return b.openedQuantity === null ? 0 : 1;
      if (b.openedQuantity === null) return -1;
      return (
        compareDecimal(a.openedQuantity, b.openedQuantity) *
        (direction === "descending" ? -1 : 1)
      );
    }
    const cmp =
      sort === "ticker"
        ? a.ticker.localeCompare(b.ticker)
        : (a.closedOn || a.openedOn || a.observedOn || "").localeCompare(
            b.closedOn || b.openedOn || b.observedOn || "",
          );
    return cmp * (direction === "descending" ? -1 : 1);
  });
  const money = (
    value: Parameters<typeof decimalNumber>[0],
    currency: string | null,
    signed = false,
  ) => (
    <Money value={{ amount: decimalNumber(value), currency }} signed={signed} />
  );
  return (
    <StatCard
      title="Options trade journal"
      action={<span>{filtered.length} lifecycles</span>}
    >
      <div className={styles.controls}>
        <label className={styles.search}>
          Search trades
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setLimit(25);
            }}
            placeholder="Ticker, contract or account"
          />
        </label>
        <Select
          aria-label="Sort option trades"
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
        >
          <option value="date">Latest lifecycle date</option>
          <option value="pnl">Realized P&L</option>
          <option value="ticker">Ticker</option>
          <option value="quantity">Opened quantity</option>
        </Select>
        <SortDirectionButton direction={direction} onChange={setDirection} />
      </div>
      <p>
        A lifecycle runs from opening exposure to flat. Multiple fills and
        partial closes stay together. Strategy is not inferred; rolls use
        separate contracts.
      </p>
      {!rows.length ? (
        <p className={styles.empty}>
          No option trades match these filters. Try a wider range or another
          currency.
        </p>
      ) : (
        <table className={styles.table}>
          <caption className={styles.srOnly}>
            Options lifecycle journal; expand a row for source executions, fees
            and matching details
          </caption>
          <thead>
            <tr>
              {[
                "Underlying / contract",
                "Direction / dates",
                "Quantity",
                "Lifecycle P&L",
                "Outcome / status",
                "Details",
              ].map((h) => (
                <th scope="col" key={h}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((trade, index) => {
              const account = accounts.find((a) => a.id === trade.accountId),
                open = expanded.includes(trade.id),
                detailsId = `option-trade-${index}`;
              return (
                <Fragment key={trade.id}>
                  <tr>
                    <th scope="row">
                      <strong>{trade.ticker}</strong>
                      <small className={styles.contract}>
                        {trade.contract?.symbol || "Unrecognized contract"}
                      </small>
                      <small>{account?.name || "Account unavailable"}</small>
                    </th>
                    <td data-label="Direction / dates">
                      <span>
                        {trade.direction}{" "}
                        {trade.contract?.type.value?.toLowerCase() || "option"}
                      </span>
                      <small>Opened {trade.openedOn || "Unavailable"}</small>
                      {trade.observedOn && (
                        <small>Event observed {trade.observedOn}</small>
                      )}
                      <small>Closed {trade.closedOn || "—"}</small>
                    </td>
                    <td data-label="Quantity">
                      <PrivateValue>
                        {trade.openedQuantity ?? "Unavailable"}
                      </PrivateValue>
                      <small>
                        Closed{" "}
                        <PrivateValue>
                          {trade.closedQuantity ?? "Unavailable"}
                        </PrivateValue>
                      </small>
                    </td>
                    <td
                      data-label="Lifecycle P&L"
                      className={
                        trade.realizedPnl !== null
                          ? Number(trade.realizedPnl) < 0
                            ? styles.loss
                            : Number(trade.realizedPnl) > 0
                              ? styles.gain
                              : ""
                          : ""
                      }
                    >
                      {money(trade.realizedPnl, trade.currency, true)}
                      <small>All realization dates</small>
                      {trade.status === "partial" && (
                        <small>Closed portion only</small>
                      )}
                    </td>
                    <td data-label="Outcome / status">
                      <span className={styles.badge}>
                        {statusLabel[trade.status]}
                      </span>
                      <small>
                        {trade.outcome === "unclassified"
                          ? "Outcome unclassified"
                          : trade.outcome}
                      </small>
                    </td>
                    <td>
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-controls={detailsId}
                        aria-label={`${open ? "Close" : "View"} trade details for ${trade.ticker}, opened ${trade.openedOn || "date unavailable"}`}
                        onClick={() =>
                          setExpanded(
                            open
                              ? expanded.filter((id) => id !== trade.id)
                              : [...expanded, trade.id],
                          )
                        }
                      >
                        {open ? "Close" : "View"}
                      </button>
                    </td>
                  </tr>
                  {open && (
                    <tr className={styles.detailRow}>
                      <td colSpan={6}>
                        <div id={detailsId} className={styles.details}>
                          <h3>{trade.ticker} · lifecycle details</h3>
                          <dl className={styles.metrics}>
                            <div>
                              <dt>Contract strike</dt>
                              <dd>
                                {money(
                                  trade.contract?.strike.amount.value ?? null,
                                  trade.contract?.strike.currency.value ?? null,
                                )}
                              </dd>
                            </div>
                            <div>
                              <dt>Expiration</dt>
                              <dd>
                                {trade.contract?.expiration.value ||
                                  "Unavailable"}
                              </dd>
                            </div>
                            <div>
                              <dt>Multiplier</dt>
                              <dd>
                                {trade.contract?.multiplier.value ||
                                  "Unavailable"}
                              </dd>
                            </div>
                            <div>
                              <dt>DTE at entry</dt>
                              <dd>{trade.entryDte ?? "Unavailable"}</dd>
                            </div>
                            <div>
                              <dt>Average entry premium / share</dt>
                              <dd>
                                {money(trade.entryPremium, trade.currency)}
                              </dd>
                            </div>
                            <div>
                              <dt>Average exit premium / share</dt>
                              <dd>
                                {money(trade.exitPremium, trade.currency)}
                              </dd>
                            </div>
                            <div>
                              <dt>Evaluable gross premiums received</dt>
                              <dd>
                                {money(trade.premiumReceived, trade.currency)}
                              </dd>
                            </div>
                            <div>
                              <dt>Evaluable gross premiums paid</dt>
                              <dd>
                                {money(trade.premiumPaid, trade.currency)}
                              </dd>
                            </div>
                            <div>
                              <dt>All execution fees</dt>
                              <dd>{money(trade.fees, trade.currency)}</dd>
                            </div>
                            <div>
                              <dt>Remaining contracts</dt>
                              <dd>
                                <PrivateValue>
                                  {trade.remainingQuantity ?? "Unavailable"}
                                </PrivateValue>
                              </dd>
                            </div>
                          </dl>
                          <p>
                            FIFO quantity links within one account, contract and
                            direction. Each matched portion receives
                            proportional source net cash and fees; residual
                            allocation preserves the original execution total.
                            Missing multipliers are never assumed to be 100.
                            Explicit zero-fee cash can be reconciled without a
                            multiplier. CSV-reported net cash and commission
                            also support cash-based accounting without one. No
                            entry Greeks are available.
                          </p>
                          {trade.issues.length > 0 ? (
                            <div role="note">
                              <strong>
                                Excluded from realized performance
                              </strong>
                              <ul>
                                {trade.issues.map((reason) => (
                                  <li key={reason}>{reason}</li>
                                ))}
                              </ul>
                            </div>
                          ) : (
                            <p>
                              Eligible from the available source history; this
                              is not a verified lifetime brokerage statement.
                            </p>
                          )}
                          <h4>Execution evidence</h4>
                          {trade.events.length > 0 && (
                            <ul className={styles.evidence}>
                              {trade.events.map((event, i) => (
                                <li key={i}>
                                  <strong>{event.type}</strong>
                                  <span>
                                    Observed {event.date || "date unavailable"}
                                  </span>
                                  <span>
                                    Source quantity{" "}
                                    <PrivateValue>
                                      {event.quantity || "Unavailable"}
                                    </PrivateValue>
                                  </span>
                                  <span>
                                    Reported cash{" "}
                                    {money(event.amount, event.currency, true)}
                                  </span>
                                  <span>
                                    Reported fees{" "}
                                    {money(event.fee, event.currency)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                          {!trade.executions.length ? (
                            <p>
                              No reliably matched execution is available for
                              this source event.
                            </p>
                          ) : (
                            <ul className={styles.evidence}>
                              {trade.executions.map((e) => (
                                <li key={e.id}>
                                  <strong>
                                    {e.kind === "expiration"
                                      ? "Confirmed zero-settlement expiration"
                                      : e.action.replaceAll("_", " ")}
                                  </strong>
                                  <span>
                                    {e.tradeDate} ·{" "}
                                    <PrivateValue>{e.quantity}</PrivateValue>{" "}
                                    contracts
                                  </span>
                                  <span>
                                    Premium{" "}
                                    {money(
                                      e.cash.premium,
                                      e.cash.currency,
                                      true,
                                    )}
                                  </span>
                                  <span>
                                    Fees {money(e.cash.fee, e.cash.currency)}
                                  </span>
                                  <span>
                                    Net cash{" "}
                                    {money(e.cash.net, e.cash.currency, true)}
                                  </span>
                                  <small>
                                    Fee convention: {e.cash.convention}.{" "}
                                    {e.csvActionMethod && (
                                      <span>
                                        {e.csvActionMethod === "source-side"
                                          ? "Action classified from matched CSV LONG/SHORT side."
                                          : "Cash reconciled with a matched Wealthsimple CSV row."}
                                      </span>
                                    )}
                                    {e.externalReferenceId
                                      ? "Related brokerage reference is available; it is not treated as a unique fill."
                                      : "No related brokerage reference."}
                                  </small>
                                </li>
                              ))}
                            </ul>
                          )}
                          {trade.realizations.length > 0 && (
                            <>
                              <h4>Recognized closed portions</h4>
                              <ul className={styles.evidence}>
                                {trade.realizations.map((r, i) => (
                                  <li key={i}>
                                    <strong>{r.date}</strong>
                                    <span>
                                      Closed{" "}
                                      <PrivateValue>{r.quantity}</PrivateValue>{" "}
                                      contracts
                                    </span>
                                    <span>
                                      Opening + closing net cash:{" "}
                                      {money(r.pnl, trade.currency, true)}
                                    </span>
                                    <span>
                                      Fees already included:{" "}
                                      {money(r.fees, trade.currency)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}
      {rows.length > limit && (
        <button type="button" onClick={() => setLimit(limit + 25)}>
          Show 25 more trades
        </button>
      )}
    </StatCard>
  );
}
