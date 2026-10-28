import { PerformanceDashboard } from "./PerformanceDashboard";
export function PerformanceLoading() {
  return (
    <PerformanceDashboard
      accounts={[]}
      today={new Date().toISOString().slice(0, 10)}
      isLoading
    />
  );
}
