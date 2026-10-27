"use client";

// The server supplies a Logo.dev URL containing only a ticker and publishable key.
import Image from "next/image";
import { useState } from "react";

export function SecurityIcon({
  symbol,
  logoUrl,
}: {
  symbol: string;
  logoUrl: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const initials =
    symbol
      .replace(/[^A-Za-z0-9]/g, "")
      .slice(0, 2)
      .toUpperCase() || "?";
  return (
    <span
      className="security-icon"
      aria-hidden="true"
      title={
        failed || !logoUrl
          ? "Ticker badge · logo unavailable"
          : `${symbol} logo`
      }
    >
      {logoUrl && !failed ? (
        <Image
          src={logoUrl}
          alt=""
          width={36}
          height={36}
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{initials}</span>
      )}
    </span>
  );
}
