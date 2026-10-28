"use client";
import { useId, useState } from "react";
import type { HistoryPoint } from "@/lib/types";
import { historyChange } from "@/lib/performance/performance";
import { money, signedMoney, signedPercent } from "@/lib/format";
import { PrivateValue } from "@/components/shared/BalancePrivacy";
function dayLabel(day: string) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}
export function HistoryChart({
  points,
  currency,
  accountCount,
  missingDates,
}: {
  points: HistoryPoint[];
  currency: string;
  accountCount: number;
  missingDates: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const id = useId();
  if (!points.length)
    return (
      <p className="empty">
        No shared daily snapshots in this date range for {currency}. Try a
        longer range or select an individual account.
      </p>
    );
  const latest = points[points.length - 1],
    selected = points[active ?? points.length - 1] ?? latest;
  const change = historyChange(points);
  const min = Math.min(...points.map((p) => p.value)),
    max = Math.max(...points.map((p) => p.value));
  const padding = Math.max((max - min) * 0.1, Math.abs(max) * 0.01, 1);
  const low = min - padding,
    high = max + padding;
  const start = Date.parse(points[0].date),
    end = Date.parse(latest.date);
  const coordinates = points.map((p) => ({
    x:
      end === start
        ? 400
        : 30 + ((Date.parse(p.date) - start) / (end - start)) * 740,
    y: 210 - ((p.value - low) / (high - low)) * 180,
  }));
  const path = coordinates
    .map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`)
    .join(" ");
  const color =
    change.amount !== null && change.amount < 0 ? "#ad3654" : "#18745f";
  const marker =
    coordinates[active ?? points.length - 1] ??
    coordinates[coordinates.length - 1];
  return (
    <article className="history-series">
      <div className="history-chart-heading">
        <div>
          <h3>{currency} account value</h3>
          <strong>
            <PrivateValue>
              {money({ amount: selected.value, currency })}
            </PrivateValue>
          </strong>
          <small>
            {dayLabel(selected.date)} · {accountCount} account(s)
          </small>
        </div>
        <div className="history-change">
          <small>Value change · includes cash flows</small>
          <b style={{ color }}>
            <PrivateValue>
              {signedMoney({ amount: change.amount, currency })}
            </PrivateValue>
          </b>
          <small>
            <PrivateValue>{signedPercent(change.percent)}</PrivateValue>
          </small>
        </div>
      </div>
      <div className="history-axis-labels">
        <small>
          High: <PrivateValue>{money({ amount: max, currency })}</PrivateValue>
        </small>
        <small>
          Low: <PrivateValue>{money({ amount: min, currency })}</PrivateValue>
        </small>
      </div>
      <svg
        className="history-svg"
        viewBox="0 0 800 240"
        role="img"
        aria-label={`${currency} daily estimated account value. Use the slider below to inspect dates.`}
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const x = ((event.clientX - bounds.left) / bounds.width) * 800;
          setActive(
            coordinates.reduce(
              (best, p, i) =>
                Math.abs(p.x - x) < Math.abs(coordinates[best].x - x)
                  ? i
                  : best,
              0,
            ),
          );
        }}
        onPointerLeave={() => setActive(null)}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity=".15" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M30 60H770 M30 135H770 M30 210H770"
          stroke="#e9edef"
          fill="none"
        />
        {points.length > 1 && (
          <path
            d={`${path} L${coordinates[coordinates.length - 1].x} 225 L${coordinates[0].x} 225 Z`}
            fill={`url(#${id})`}
          />
        )}
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {active !== null && (
          <path
            d={`M${marker.x} 25V225`}
            stroke={color}
            strokeDasharray="4 5"
            opacity=".3"
          />
        )}
        <circle
          cx={marker.x}
          cy={marker.y}
          r="5"
          fill={color}
          stroke="white"
          strokeWidth="2"
        />
      </svg>
      <div className="history-date-labels">
        <small>{dayLabel(points[0].date)}</small>
        <small>{dayLabel(latest.date)}</small>
      </div>
      {points.length > 1 && (
        <label className="history-slider-label">
          Inspect daily snapshots
          <input
            type="range"
            min="0"
            max={points.length - 1}
            value={active ?? points.length - 1}
            onChange={(event) => setActive(Number(event.target.value))}
            aria-valuetext={dayLabel(selected.date)}
          />
        </label>
      )}
      {points.length < 2 && (
        <p className="muted">
          Only one daily snapshot is available. A period change cannot be
          calculated.
        </p>
      )}
      {missingDates > 0 && (
        <p className="muted">
          {missingDates} date(s) omitted because not every included account has
          a snapshot. No missing balances were filled in.
        </p>
      )}
      <details className="history-data">
        <summary>View daily values</summary>
        <div
          className="history-data-scroll"
          tabIndex={0}
          role="region"
          aria-label={`${currency} daily values`}
        >
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th className="numeric">Account value</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.date}>
                  <td>{dayLabel(p.date)}</td>
                  <td className="numeric">
                    <PrivateValue>
                      {money({ amount: p.value, currency })}
                    </PrivateValue>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </article>
  );
}
