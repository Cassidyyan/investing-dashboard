"use client";
import { NavigationReady } from "@/components/NavigationProgress";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main>
      <NavigationReady />
      <p className="eyebrow">HOLDINGS / PRIVATE</p>
      <h1>Portfolio unavailable.</h1>
      <p role="alert">
        Something prevented the dashboard from loading. Check your local
        configuration and connection, then try again.
      </p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
