export function ActivityIcon({ type }: { type: string }) {
  const name = type.toLowerCase();
  const glyph = /buy|purchase/.test(name)
    ? "↙"
    : /sell/.test(name)
      ? "↗"
      : /dividend|interest/.test(name)
        ? "＋"
        : /transfer|contribution|withdraw/.test(name)
          ? "⇄"
          : "≡";
  return (
    <span className="activity-type-icon" aria-hidden="true">
      {glyph}
    </span>
  );
}
