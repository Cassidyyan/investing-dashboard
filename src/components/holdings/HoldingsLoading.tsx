import type { Portfolio } from "@/lib/types";
import { HoldingsDashboard } from "./HoldingsDashboard";
export function HoldingsLoading() {
  const portfolio: Portfolio = {
    configured: true,
    retrievedAt: new Date().toISOString(),
    accounts: { status: "ok", data: [] },
    connections: { status: "ok", data: [] },
  };
  return (
    <HoldingsDashboard
      portfolio={portfolio}
      rate={{ status: "error", message: "Loading rate" }}
      isLoading
    />
  );
}
