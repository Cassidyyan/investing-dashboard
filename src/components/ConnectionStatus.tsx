import type { ConnectionView, Result } from "@/lib/types";
import { SectionState } from "./SectionState";
export function ConnectionStatus({
  result,
}: {
  result: Result<ConnectionView[]>;
}) {
  return (
    <SectionState
      result={result}
      empty={result.status === "ok" && !result.data.length}
    >
      {(rows) => (
        <>
          <ul className="connections">
            {rows.map((c, i) => (
              <li key={i}>
                <b>{c.name}</b>
                <span
                  className={`badge ${c.status === "Connected" ? "healthy" : "warning"}`}
                >
                  {c.status}
                </span>
              </li>
            ))}
          </ul>
          {rows.some((c) => c.status !== "Connected") && (
            <p className="notice">
              Review incomplete or disabled connections in your{" "}
              <a
                href="https://dashboard.snaptrade.com"
                target="_blank"
                rel="noreferrer"
              >
                SnapTrade dashboard
              </a>
              .
            </p>
          )}
        </>
      )}
    </SectionState>
  );
}
