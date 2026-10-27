import type { AccountData } from "@/lib/types";
import { date } from "@/lib/format";
import { isOption } from "@/lib/holdings";
import { getSecurityLogoUrl } from "@/server/security-logo";
import { SortableHoldingsTable } from "@/components/holdings/SortableHoldingsTable";
import { SectionState } from "@/components/shared/SectionState";
export function PositionsTable({
  accounts,
  category,
}: {
  accounts: AccountData[];
  category?: "holdings" | "options";
}) {
  const filteredAccounts = accounts.map((a) => ({
    ...a,
    positions:
      a.positions.status === "ok"
        ? {
            ...a.positions,
            data: {
              ...a.positions.data,
              rows: a.positions.data.rows.filter(
                (p) =>
                  p.units !== 0 &&
                  (!category ||
                    (category === "options"
                      ? isOption(p.kind)
                      : !isOption(p.kind))),
              ),
            },
          }
        : a.positions,
  }));
  const visibleAccounts = filteredAccounts.filter(
    (a) =>
      category !== "options" ||
      a.positions.status === "error" ||
      a.positions.data.rows.length > 0,
  );
  if (!visibleAccounts.length)
    return (
      <p className="empty">
        {category === "options"
          ? "No current option positions available."
          : "No visible accounts available."}
      </p>
    );
  return (
    <>
      {visibleAccounts.map((a) => (
        <details
          className="account-section account-disclosure"
          key={a.account.id}
        >
          <summary>
            <span>
              {a.account.name} <small>{a.account.suffix}</small>
            </span>
            <span className="badge">
              {a.positions.status === "ok"
                ? `${a.positions.data.rows.length} records`
                : "Unavailable"}
            </span>
          </summary>
          <SectionState
            result={a.positions}
            empty={a.positions.status === "ok" && !a.positions.data.rows.length}
          >
            {(p) => (
              <>
                <p className="muted">
                  Position data as of{" "}
                  <span className="data-text">{date(p.asOf)}</span>
                </p>
                <SortableHoldingsTable
                  accountName={a.account.name}
                  rows={p.rows.map((row, index) => ({
                    ...row,
                    rowKey: `${row.instrumentId || row.symbol}-${index}`,
                    logoUrl: getSecurityLogoUrl(row.symbol, row.kind),
                  }))}
                />
                <p className="muted holdings-footnote">
                  Average cost is the reported book price per share or unit. Net
                  return here means unrealized price gain/loss on the open
                  position, not lifetime performance; it excludes realized
                  gains, dividends, fees, taxes, and FX conversion. Option
                  values include the reported contract multiplier. Missing cost
                  data stays unavailable.
                </p>
              </>
            )}
          </SectionState>
        </details>
      ))}
    </>
  );
}
