export function numeric(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  // Reject empty, hexadecimal, Infinity and arbitrary coercible values.
  if (
    typeof value === "string" &&
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())
  )
    return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
export function nonEmptyText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
export function currencyCode(value: unknown): string | null {
  const code = nonEmptyText(value)?.toUpperCase();
  return code && /^[A-Z]{3}$/.test(code) ? code : null;
}
export function calendarDay(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(value))
    return null;
  const day = value.slice(0, 10),
    time = Date.parse(`${day}T00:00:00Z`);
  if (
    !Number.isFinite(time) ||
    new Date(time).toISOString().slice(0, 10) !== day
  )
    return null;
  if (
    value.length > 10 &&
    (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(
      value,
    ) ||
      !Number.isFinite(Date.parse(value)))
  )
    return null;
  return day;
}
