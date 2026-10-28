import type { HistoryPoint } from "@/lib/types";
import { historyChange } from "./performance";
export function historyDay(day: string) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}
export function valueChange(points: HistoryPoint[]) {
  const result = historyChange(points);
  return result.amount === null
    ? null
    : { amount: result.amount, percent: result.percent };
}
export function chartGeometry(points: HistoryPoint[]) {
  const values = points.map((p) => p.value),
    min = Math.min(...values),
    max = Math.max(...values);
  const pad = Math.max((max - min) * 0.12, Math.abs(max) * 0.01, 1);
  const start = Date.parse(points[0].date),
    end = Date.parse(points.at(-1)!.date);
  const coords = points.map((p) => ({
    x:
      end === start
        ? 420
        : 128 + ((Date.parse(p.date) - start) / (end - start)) * 648,
    y: 214 - ((p.value - (min - pad)) / (max - min + 2 * pad)) * 180,
  }));
  return {
    min,
    max,
    low: min - pad,
    high: max + pad,
    coords,
    path: coords.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" "),
    segments: coords.slice(1).map((p, i) => ({
      path: `M${coords[i].x},${coords[i].y} L${p.x},${p.y}`,
      gap:
        Date.parse(points[i + 1].date) - Date.parse(points[i].date) > 86400000,
    })),
  };
}
