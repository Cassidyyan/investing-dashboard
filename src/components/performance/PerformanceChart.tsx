"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { AccountFunding, HistoryPoint, Result } from "@/lib/types";
import {
  chartGeometry,
  historyDay,
  valueChange,
} from "@/lib/performance/presentation";
import { useBalancePrivacy } from "@/components/shared/BalancePrivacy";
import { MoneyValue } from "@/components/shared/MoneyValue";
import { ChangeBadge } from "@/components/shared/ChangeBadge";
import { ChartTooltip } from "./ChartTooltip";
import shared from "@/styles/dashboard.module.css";
import styles from "./Performance.module.css";
export function PerformanceChart({
  points,
  currency,
  funding,
}: {
  points: HistoryPoint[];
  currency: string;
  funding: Result<AccountFunding>;
}) {
  const [active, setActive] = useState<number | null>(null),
    [view, setView] = useState<"chart" | "table">("chart");
  const { hidden } = useBalancePrivacy(),
    id = useId();
  const svgRef = useRef<SVGSVGElement>(null),
    [svgWidth, setSvgWidth] = useState(800);
  useEffect(() => {
    if (!svgRef.current) return;
    const observer = new ResizeObserver((entries) =>
      setSvgWidth(entries[0].contentRect.width),
    );
    observer.observe(svgRef.current);
    return () => observer.disconnect();
  }, [view, points.length]);
  const labelSize = (12 * 800) / Math.max(1, svgWidth);
  const g = chartGeometry(points),
    index = Math.min(active ?? points.length - 1, points.length - 1),
    marker = g.coords[index];
  const previousChange = valueChange(
    points.slice(Math.max(0, index - 1), index + 1),
  );
  const inspect = (event: React.PointerEvent<SVGSVGElement>) => {
    const r = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - r.left) / r.width) * 800;
    setActive(
      g.coords.reduce(
        (best, p, i) =>
          Math.abs(p.x - x) < Math.abs(g.coords[best].x - x) ? i : best,
        0,
      ),
    );
  };
  return (
    <>
      <div className={styles.chartToolbar}>
        <p>
          {historyDay(points[0].date)} – {historyDay(points.at(-1)!.date)}
        </p>
        <div
          className={styles.segmented}
          role="group"
          aria-label="History view"
        >
          {(["chart", "table"] as const).map((v) => (
            <button
              type="button"
              key={v}
              aria-pressed={view === v}
              onClick={() => setView(v)}
            >
              {v === "chart" ? "Chart" : "Table"}
            </button>
          ))}
        </div>
      </div>
      <p className={styles.srOnly} id={`${id}-summary`}>
        Observed daily values from {historyDay(points[0].date)} to{" "}
        {historyDay(points.at(-1)!.date)}. Start{" "}
        <MoneyValue amount={points[0].value} currency={currency} />, current{" "}
        <MoneyValue amount={points.at(-1)!.value} currency={currency} />, high{" "}
        <MoneyValue amount={g.max} currency={currency} />, low{" "}
        <MoneyValue amount={g.min} currency={currency} />. Change{" "}
        <ChangeBadge
          className={styles.changeBadge}
          change={valueChange(points)}
          currency={currency}
          showPercentWhenHidden
        />
        . Use Table for all daily observations.
      </p>
      {view === "table" ? (
        <table className={styles.valuesTable}>
          <caption className={styles.srOnly}>
            {currency} observed values and changes
          </caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Value</th>
              <th scope="col">Daily change</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={p.date}>
                <td>{historyDay(p.date)}</td>
                <td>
                  <MoneyValue amount={p.value} currency={currency} />
                </td>
                <td>
                  <ChangeBadge
                    className={styles.changeBadge}
                    change={i ? valueChange(points.slice(i - 1, i + 1)) : null}
                    currency={currency}
                    showPercentWhenHidden
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : points.length === 1 ? (
        <p className={styles.empty}>
          One daily snapshot is available. Select a longer range to compare
          observations.
        </p>
      ) : (
        <>
          <div className={styles.chartPlot}>
            {active !== null && (
              <div
                className={styles.hoverCard}
                aria-hidden="true"
                style={{
                  left: `clamp(0px, calc(${marker.x / 8}% - 145px), max(0px, calc(100% - 290px)))`,
                }}
              >
                <ChartTooltip
                  points={points}
                  index={index}
                  currency={currency}
                  funding={funding}
                />
              </div>
            )}
            <svg
              ref={svgRef}
              className={`${styles.chart} ${hidden ? shared.blurred : ""}`}
              viewBox="0 0 800 250"
              role="img"
              tabIndex={0}
              aria-label={`${currency} daily account value. Use left and right arrows to inspect observed dates.`}
              aria-describedby={`${id}-summary`}
              onPointerMove={inspect}
              onPointerDown={inspect}
              onPointerLeave={(e) => {
                if (e.pointerType !== "touch") setActive(null);
              }}
              onFocus={() =>
                setActive((previous) => previous ?? points.length - 1)
              }
              onBlur={() => setActive(null)}
              onKeyDown={(e) => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
                  return;
                e.preventDefault();
                setActive(
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? points.length - 1
                      : Math.max(
                          0,
                          Math.min(
                            points.length - 1,
                            index + (e.key === "ArrowLeft" ? -1 : 1),
                          ),
                        ),
                );
              }}
            >
              <title>
                Hover, touch, or focus and use the arrow keys to inspect an
                observed date.
              </title>
              <defs>
                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--ov-brand)"
                    stopOpacity=".15"
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--ov-brand)"
                    stopOpacity="0"
                  />
                </linearGradient>
              </defs>
              {[0, 0.5, 1].map((f) => (
                <g key={f}>
                  <path
                    d={`M128 ${34 + f * 180} H776`}
                    stroke="var(--ov-border)"
                  />
                  <text
                    x="120"
                    y={38 + f * 180}
                    textAnchor="end"
                    className={styles.axis}
                    style={{ fontSize: labelSize }}
                  >
                    {hidden
                      ? "••••"
                      : new Intl.NumberFormat("en-CA", {
                          notation: "compact",
                          maximumFractionDigits: 1,
                        }).format(g.high - f * (g.high - g.low))}
                  </text>
                </g>
              ))}
              <path
                d={`${g.path} L${g.coords.at(-1)!.x},214 L${g.coords[0].x},214 Z`}
                fill={`url(#${id})`}
              />
              {g.segments.map((segment, i) => (
                <path
                  key={i}
                  d={segment.path}
                  data-gap={segment.gap || undefined}
                  fill="none"
                  stroke="var(--ov-brand)"
                  strokeWidth="2.5"
                  strokeDasharray={segment.gap ? "5 5" : undefined}
                  strokeLinecap="round"
                />
              ))}
              {g.coords.map((p, i) => (
                <circle
                  key={points[i].date}
                  cx={p.x}
                  cy={p.y}
                  r={i === points.length - 1 ? 4.5 : 2}
                  fill="var(--ov-brand)"
                  stroke="white"
                  strokeWidth="1"
                />
              ))}
              {[
                ["High", g.max],
                ["Low", g.min],
              ].map(([label, value]) => {
                const i = points.findIndex((p) => p.value === value),
                  p = g.coords[i];
                return (
                  <g key={label}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="4"
                      fill="white"
                      stroke="var(--ov-brand)"
                    />
                    <text
                      x={Math.min(
                        776 - labelSize * 2.5,
                        Math.max(140, p.x + labelSize * 0.75),
                      )}
                      y={
                        label === "High"
                          ? Math.max(labelSize, p.y - labelSize * 0.8)
                          : Math.min(240, p.y + labelSize * 1.4)
                      }
                      textAnchor="start"
                      className={styles.axis}
                      style={{ fontSize: labelSize }}
                    >
                      {label}
                    </text>
                  </g>
                );
              })}
              {active !== null && (
                <>
                  <path
                    d={`M${marker.x},24 V224`}
                    stroke="var(--ov-brand)"
                    strokeDasharray="4 4"
                  />
                  <circle
                    cx={marker.x}
                    cy={marker.y}
                    r="5"
                    fill="var(--ov-brand)"
                    stroke="white"
                    strokeWidth="2"
                  />
                </>
              )}
            </svg>
          </div>
          <p className={styles.srOnly} aria-live="polite">
            {active === null ? (
              "Hover, touch, or focus the chart and use ← → to inspect."
            ) : (
              <>
                {historyDay(points[index].date)} ·{" "}
                <MoneyValue amount={points[index].value} currency={currency} />{" "}
                · Change{" "}
                <ChangeBadge
                  className={styles.changeBadge}
                  change={previousChange}
                  currency={currency}
                  showPercentWhenHidden
                />
              </>
            )}
          </p>
        </>
      )}
    </>
  );
}
