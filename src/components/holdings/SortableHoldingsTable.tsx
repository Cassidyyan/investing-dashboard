"use client";

import { PrivateValue } from "@/components/shared/BalancePrivacy";

// Presentational client component: sorting never fetches or changes portfolio data.
import { useState } from "react";
import type { PositionView } from "@/lib/types";
import { money, quantity, signedMoney, signedPercent } from "@/lib/format";
import {
  sortPositions,
  positionSortLabels,
  type PositionSortKey,
  type SortDirection,
} from "@/lib/sort-positions";
import { SecurityIcon } from "@/components/shared/SecurityIcon";
type DisplayPosition = PositionView & {
  rowKey: string;
  logoUrl: string | null;
};
export function SortableHoldingsTable({
  rows,
  accountName,
}: {
  rows: DisplayPosition[];
  accountName: string;
}) {
  const [sort, setSort] = useState<{
    key: PositionSortKey;
    direction: SortDirection;
  }>({ key: "value", direction: "descending" });
  const sortedRows = sortPositions(rows, sort.key, sort.direction);
  return (
    <>
      <p className="holdings-sort-note muted">
        Click a column to sort. Price, value, and return use displayed amounts
        without currency conversion; net return sorts by money, not percent.
      </p>
      <p className="sr-only" role="status">
        Sorted by {positionSortLabels[sort.key]},{" "}
        {sort.direction === "descending"
          ? "highest to lowest"
          : "lowest to highest"}
        . Unavailable values last.
      </p>
      <div className="table-wrap holdings-table-wrap">
        <table className="holdings-table">
          <caption className="sr-only">Positions for {accountName}</caption>
          <colgroup>
            <col className="holding-security-col" />
            <col className="holding-quantity-col" />
            <col span={4} />
          </colgroup>
          <thead>
            <tr>
              <th>Security</th>
              {(Object.keys(positionSortLabels) as PositionSortKey[]).map(
                (key) => (
                  <th
                    key={key}
                    className="numeric"
                    scope="col"
                    aria-sort={sort.key === key ? sort.direction : "none"}
                  >
                    <button
                      type="button"
                      className="holding-sort-button"
                      onClick={() =>
                        setSort((current) => ({
                          key,
                          direction:
                            current.key === key &&
                            current.direction === "descending"
                              ? "ascending"
                              : "descending",
                        }))
                      }
                      aria-label={`Sort ${positionSortLabels[key]} ${sort.key === key && sort.direction === "descending" ? "lowest to highest" : "highest to lowest"}`}
                    >
                      <span>{positionSortLabels[key]}</span>
                      <span className="sort-indicator" aria-hidden="true">
                        {sort.key === key
                          ? sort.direction === "descending"
                            ? "↓"
                            : "↑"
                          : "↕"}
                      </span>
                    </button>
                    {key === "return" && <small>Unrealized · amount</small>}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r) => (
              <tr key={r.rowKey}>
                <td>
                  <span className="security-label">
                    <SecurityIcon
                      key={`${r.symbol}-${r.kind}`}
                      symbol={r.symbol}
                      logoUrl={r.logoUrl}
                    />
                    <span className="security-copy">
                      <b title={r.symbol}>{r.symbol}</b>
                      <small
                        className="holding-description"
                        title={r.description}
                      >
                        {r.description}
                      </small>
                      <span className="holding-type">
                        {r.kind} · {r.price.currency || "Currency unknown"}
                        {r.units !== null && r.units < 0 ? " · Short" : ""}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="numeric">
                  <PrivateValue>{quantity(r.units)}</PrivateValue>
                </td>
                <td className="numeric">
                  <PrivateValue>
                    {money(
                      r.averageCost ?? {
                        amount: null,
                        currency: r.price.currency,
                      },
                    )}
                  </PrivateValue>
                </td>
                <td className="numeric">
                  <PrivateValue>{money(r.price)}</PrivateValue>
                </td>
                <td className="numeric holding-value">
                  <PrivateValue>{money(r.value)}</PrivateValue>
                </td>
                <td
                  className={`numeric holding-return ${r.unrealizedReturn?.amount != null && r.unrealizedReturn.amount > 0 ? "return-gain" : r.unrealizedReturn?.amount != null && r.unrealizedReturn.amount < 0 ? "return-loss" : ""}`}
                >
                  <span>
                    <PrivateValue>
                      {signedMoney(
                        r.unrealizedReturn ?? {
                          amount: null,
                          currency: r.price.currency,
                        },
                      )}
                    </PrivateValue>
                  </span>
                  <small className="return-percent">
                    <PrivateValue>
                      {signedPercent(r.unrealizedReturnPercent)}
                    </PrivateValue>
                  </small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
