import type { ExcludedPosition } from "@/lib/holdings/holdings-view";
import { InfoPopover } from "@/components/shared/InfoPopover";
import styles from "./Holdings.module.css";
export function ExcludedPositionsPopover({
  entries,
}: {
  entries: ExcludedPosition[];
}) {
  if (!entries.length) return null;
  return (
    <div className={styles.excluded}>
      <InfoPopover
        label={`${entries.length} positions excluded. View reasons`}
        trigger={`${entries.length} positions excluded · View`}
        badge
      >
        <ul className={styles.excludedList}>
          {entries.map((e) => (
            <li key={e.key}>
              <strong>{e.symbol}</strong>
              <span>{e.account}</span>
              <span>{e.reason}</span>
            </li>
          ))}
        </ul>
      </InfoPopover>
    </div>
  );
}
