import { expect, it } from "vitest";
import { chartGeometry, valueChange } from "@/lib/performance/presentation";
it("positions observed dates proportionally and marks missing calendar days without inventing points", () => {
  const points = [
    { date: "2026-01-01", value: 100 },
    { date: "2026-01-02", value: 110 },
    { date: "2026-01-05", value: 90 },
  ];
  const g = chartGeometry(points);
  expect(g.coords).toHaveLength(3);
  expect(g.segments.map((s) => s.gap)).toEqual([false, true]);
  expect(g.coords[1].x - g.coords[0].x).toBeCloseTo(
    (g.coords[2].x - g.coords[1].x) / 3,
  );
  expect(g.min).toBe(90);
  expect(g.max).toBe(110);
  expect(valueChange(points)).toEqual({ amount: -10, percent: -10 });
});
it("keeps single and constant values finite and does not invent a period percentage", () => {
  const p = { date: "2026-01-01", value: 0 };
  expect(
    chartGeometry([p]).coords.every(
      (c) => Number.isFinite(c.x) && Number.isFinite(c.y),
    ),
  ).toBe(true);
  expect(valueChange([p])).toBeNull();
});
