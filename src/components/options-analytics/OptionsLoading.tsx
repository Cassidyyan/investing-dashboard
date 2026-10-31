"use client";
import { OptionsAnalyticsDashboard } from "./OptionsAnalyticsDashboard";
export function OptionsLoading() {
  return (
    <OptionsAnalyticsDashboard
      isLoading
      data={{
        trades: [],
        issues: [],
        accounts: [],
        openPositions: [],
        updatedAt: "",
        configured: true,
        error: null,
        reconnect: false,
      }}
    />
  );
}
