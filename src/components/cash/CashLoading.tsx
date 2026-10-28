import type { Portfolio } from "@/lib/types";
import { CashDashboard } from "./CashDashboard";
export function CashLoading() {
  const portfolio: Portfolio = {
    configured: true,
    retrievedAt: new Date().toISOString(),
    accounts: { status: "ok", data: [] },
    connections: { status: "ok", data: [] },
  };
  return <CashDashboard portfolio={portfolio} isLoading />;
}
