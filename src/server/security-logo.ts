import "server-only";

// The image API uses a publishable pk_ key. Reject secret keys before any URL
// reaches browser props. SnapTrade credentials are never used for logos.
export function getSecurityLogoUrl(
  symbol: string,
  kind: string,
): string | null {
  const key = process.env.LOGO_DEV_PUBLISHABLE_KEY?.trim();
  if (!key || !/^pk_[A-Za-z0-9_-]+$/.test(key)) return null;
  if (!["stock", "adr", "cef", "etf", "mutualfund", "other"].includes(kind))
    return null;
  if (!/^[A-Z0-9][A-Z0-9.^-]{0,19}$/.test(symbol)) return null;
  const url = new URL(
    `https://img.logo.dev/ticker/${encodeURIComponent(symbol)}`,
  );
  url.searchParams.set("token", key);
  url.searchParams.set("size", "64");
  url.searchParams.set("retina", "true");
  url.searchParams.set("format", "png");
  url.searchParams.set("fallback", "404");
  return url.toString();
}
