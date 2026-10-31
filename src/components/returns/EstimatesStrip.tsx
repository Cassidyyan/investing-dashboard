import styles from "./Returns.module.css";
export function EstimatesStrip({
  ranked,
  total,
  caveats,
  onDetails,
}: {
  ranked: number;
  total: number;
  caveats: boolean;
  onDetails: () => void;
}) {
  return (
    <aside
      aria-label="Return estimate coverage"
      className={`${styles.estimatesStrip} ${caveats ? styles.caveat : ""}`}
    >
      <span>
        {ranked} of {total} holdings ranked · Estimates
      </span>
      <button type="button" aria-haspopup="dialog" onClick={onDetails}>
        Details
      </button>
    </aside>
  );
}
