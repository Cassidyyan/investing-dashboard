import { ActivityDashboard } from "./ActivityDashboard";
export function ActivityLoading() {
  return (
    <ActivityDashboard
      isLoading
      portfolio={{
        configured: true,
        retrievedAt: new Date().toISOString(),
        accounts: { status: "ok", data: [] },
        connections: { status: "ok", data: [] },
      }}
    />
  );
}
