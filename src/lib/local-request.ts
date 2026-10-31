// Defense against DNS rebinding and cross-site browser requests to a local app.
// This is a local-only boundary, not authentication for a hosted deployment.
export function localRequestAllowed(headers: Headers, url: string) {
  const parsed = new URL(url);
  const host = headers.get("host") || parsed.host;
  if (!/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/.test(host))
    return false;
  const site = headers.get("sec-fetch-site");
  if (site === "cross-site") return false;
  const origin = headers.get("origin");
  if (origin) {
    try {
      const source = new URL(origin);
      if (source.host !== host || source.protocol !== parsed.protocol)
        return false;
    } catch {
      return false;
    }
  }
  return true;
}
