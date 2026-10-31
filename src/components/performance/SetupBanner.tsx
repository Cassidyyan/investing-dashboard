import { InfoPopover } from "@/components/shared/InfoPopover";
import styles from "./Performance.module.css";
export function SetupBanner({
  messages,
  onRetry,
  refreshing,
}: {
  messages: string[];
  onRetry: () => void;
  refreshing: boolean;
}) {
  if (!messages.length) return null;
  return (
    <div className={styles.setup} role="status">
      <div>
        <strong>Some performance data is unavailable</strong>
        <p>
          Available history remains visible. Check source access or reconnect,
          then retry.
        </p>
      </div>
      <InfoPopover
        label="Unavailable performance data and setup"
        trigger="Setup guidance"
        align="start"
      >
        {[...new Set(messages)].map((m) => (
          <p key={m}>{m}</p>
        ))}
        <p>
          Account value history is a beta add-on, with up to one year of daily
          values. Its schema can change. Brokerage-reported returns depend on
          the brokerage and are separate from this add-on.
        </p>
        <a
          href="https://dashboard.snaptrade.com"
          target="_blank"
          rel="noreferrer"
        >
          Open SnapTrade ↗
        </a>
      </InfoPopover>
      <button type="button" onClick={onRetry} disabled={refreshing}>
        Retry
      </button>
    </div>
  );
}
