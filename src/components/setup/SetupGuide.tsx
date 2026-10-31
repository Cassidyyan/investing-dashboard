import styles from "./SetupGuide.module.css";
export function SetupGuide({
  errors,
  demo,
}: {
  errors: string[];
  demo: boolean;
}) {
  if (demo)
    return (
      <aside className={styles.banner} aria-label="Demo mode">
        <strong>Demo mode · fictional data</strong>
        <p>
          Every account, holding and transaction is synthetic. SnapTrade and
          private exports are disabled. Set HOLDINGS_DEMO_MODE=false and
          configure your own credentials locally to switch to your accounts.
        </p>
      </aside>
    );
  if (!errors.length) return null;
  return (
    <aside className={styles.banner} aria-label="Local setup">
      <h2>Set up your own holdings dashboard</h2>
      <p>
        Credentials belong in your local editor, never in this browser or chat.
      </p>
      <ol>
        <li>
          Copy <code>.env.example</code> to <code>.env.local</code> if you have
          not created it yet.
        </li>
        <li>
          Enter your own SnapTrade Personal client ID and consumer key in{" "}
          <code>.env.local</code>.
        </li>
        <li>
          Connect your brokerage in the{" "}
          <a
            href="https://dashboard.snaptrade.com/"
            target="_blank"
            rel="noreferrer"
          >
            SnapTrade dashboard
          </a>
          , choosing read-only access where offered.
        </li>
        <li>
          Restart the local server, then refresh. Run{" "}
          <code>npm run check:config</code> for a local configuration check.
        </li>
      </ol>
      <ul>
        {errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
      <p>
        To explore fictional accounts first, set{" "}
        <code>HOLDINGS_DEMO_MODE=true</code> in <code>.env.local</code>.
      </p>
    </aside>
  );
}
