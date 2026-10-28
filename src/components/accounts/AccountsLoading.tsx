import type { Portfolio } from "@/lib/types";
import { AccountsDashboard } from "./AccountsDashboard";
export function AccountsLoading() {
  const portfolio: Portfolio = {
    configured: true,
    retrievedAt: new Date().toISOString(),
    accounts: { status: "ok", data: [] },
    connections: { status: "ok", data: [] },
  };
  return (
    <AccountsDashboard
      portfolio={portfolio}
      rate={{ status: "error", message: "Loading rate" }}
      isLoading
    />
  );
}
