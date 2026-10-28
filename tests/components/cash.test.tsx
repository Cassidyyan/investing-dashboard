import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { CashDashboard } from "@/components/cash/CashDashboard";
import { CashLoading } from "@/components/cash/CashLoading";
import { createCashPreview } from "@/lib/cash-preview";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => "/cash",
}));
it("keeps three columns and distinguishes the personal HYSA assumption from brokerage-reported banking", () => {
  const html = renderToStaticMarkup(
    <CashDashboard portfolio={createCashPreview("sample")} preview="sample" />,
  );
  expect(html.match(/scope="col"/g)).toHaveLength(3);
  expect(html).toContain("Deposit / banking");
  expect(html).toContain("HYSA");
  expect(html).not.toContain("HYSA (assumed)");
  expect(html).toContain("assumed to earn a higher yield than chequing");
  expect(html).toContain("Figures differ");
  expect(html).toContain("invented sample data");
  expect(html).toContain("does not convert currencies");
  expect(html).toContain("4,250.00");
  expect(html).toContain("900.00");
});
it("does not repeat common sync timestamps on each account", () => {
  const p = createCashPreview("sample");
  expect(renderToStaticMarkup(<CashDashboard portfolio={p} />)).not.toContain(
    "Account sync:",
  );
  if (p.accounts.status !== "ok") throw Error("fixture");
  p.accounts.data[1].account.syncedAt = "2026-10-26T18:00:00Z";
  expect(renderToStaticMarkup(<CashDashboard portfolio={p} />)).toContain(
    "Account sync:",
  );
});
it("masks all cash and reported amounts in the hidden preview, including popover content", () => {
  const html = renderToStaticMarkup(
    <CashDashboard portfolio={createCashPreview("hidden")} preview="hidden" />,
  );
  for (const value of ["4,250", "2,500", "1,750", "1,800", "900.00"])
    expect(html).not.toContain(value);
  expect(html).toContain("••••");
  expect(html).toContain("Sample chequing");
});
it("supports skeletons, empty links to Portfolio, reconnect errors, and disabled refresh states", () => {
  const loading = renderToStaticMarkup(<CashLoading />);
  expect(loading).toContain("Loading cash summary");
  expect(loading).not.toContain("Sample chequing");
  const empty = renderToStaticMarkup(
    <CashDashboard portfolio={createCashPreview("empty")} />,
  );
  expect(empty).toContain("No cash accounts to show");
  expect(empty).toContain('href="/accounts"');
  const error = renderToStaticMarkup(
    <CashDashboard portfolio={createCashPreview("error")} />,
  );
  expect(error).toContain('role="alert"');
  expect(error).toContain("Reconnect in SnapTrade");
  const refreshing = renderToStaticMarkup(
    <CashDashboard
      portfolio={createCashPreview("sample")}
      preview="refreshing"
    />,
  );
  expect(refreshing).toContain("Refreshing…");
  expect(refreshing).toContain('aria-busy="true"');
  expect(refreshing).toContain("disabled");
});
