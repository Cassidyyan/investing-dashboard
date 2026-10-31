import { StatCard } from "@/components/shared/StatCard";
import { InfoPopover } from "@/components/shared/InfoPopover";
import { Money } from "@/components/shared/Money";
import { decimalNumber } from "@/lib/financial/decimal";
import { signedPercent } from "@/lib/format";
import type { OptionsAnalytics } from "@/lib/options/analytics";
import styles from "./OptionsAnalytics.module.css";
export function OptionsSummary({
  stats,
  currency,
  openCount,
  csvSource = false,
}: {
  stats: OptionsAnalytics;
  currency: string;
  openCount: number;
  csvSource?: boolean;
}) {
  const amount = (n: Parameters<typeof decimalNumber>[0], signed = false) => (
    <Money value={{ amount: decimalNumber(n), currency }} signed={signed} />
  );
  return (
    <>
      <div className={styles.kpis}>
        <StatCard
          title="Net realized P&L"
          className={styles.hero}
          action={
            <InfoPopover label="Realized P&L calculation">
              Sum of matched opening and closing net cash, with attributable
              fees. Includes supported partial closes at their realization date.
              Open premium is not profit. Excluded records do not contribute.
            </InfoPopover>
          }
        >
          <div className={styles.big}>{amount(stats.pnl, true)}</div>
          <p>Evaluable closed quantities · {currency}</p>
          {csvSource && (
            <p>
              CSV trade estimate · reported commission included · unallocated
              account/FX fees excluded
            </p>
          )}
        </StatCard>
        <StatCard
          title="Win rate"
          action={
            <InfoPopover label="Win rate denominator">
              Winning completed lifecycles divided by all completed,
              classifiable lifecycles. Breakeven trades are included in the
              denominator and counted separately. Open and partially closed
              lifecycles are excluded.
            </InfoPopover>
          }
        >
          <div className={styles.big}>
            {stats.winRate === null
              ? "Unavailable"
              : `${stats.winRate.toFixed(1)}%`}
          </div>
          <p>
            {stats.winners} wins · {stats.losers} losses · {stats.breakeven}{" "}
            breakeven
          </p>
        </StatCard>
        <StatCard
          title="Gross premiums collected"
          action={
            <InfoPopover label="Premium collected calculation">
              Actual gross premium credits on evaluable executions, before fees.
              Opening short credits and closing long credits are separate below.
              They include still-open short trades and are not realized profit.
            </InfoPopover>
          }
        >
          <div className={styles.big}>{amount(stats.premiumReceived)}</div>
          <p>{stats.missingCash} executions excluded from premium amounts</p>
        </StatCard>
        <StatCard
          title="Net premium cash flow"
          action={
            <InfoPopover label="Net premium cash flow calculation">
              Gross premium credits minus gross premium debits, before fees.
              This cash-flow measure includes open exposure and is not realized
              P&L.
            </InfoPopover>
          }
        >
          <div className={styles.big}>{amount(stats.netPremium, true)}</div>
          <p>Received less paid · before fees</p>
        </StatCard>
      </div>
      <StatCard
        title="Trading performance"
        action={
          <InfoPopover label="Trading performance scope">
            Completed-trade statistics use full lifecycle P&L and final closing
            date. Average wins/losses exclude breakeven trades. Profit factor is
            gross winning lifecycle profit divided by absolute losing lifecycle
            profit. Current positions are a separate snapshot, not reconstructed
            history.
          </InfoPopover>
        }
      >
        <dl className={styles.metrics}>
          <div>
            <dt>Completed trades</dt>
            <dd>{stats.completed.length}</dd>
          </div>
          <div>
            <dt>Average win</dt>
            <dd>{amount(stats.averageWin, true)}</dd>
          </div>
          <div>
            <dt>Average loss</dt>
            <dd>{amount(stats.averageLoss, true)}</dd>
          </div>
          <div>
            <dt>Profit factor</dt>
            <dd>
              {stats.profitFactor.status === "finite"
                ? decimalNumber(stats.profitFactor.value)?.toFixed(2)
                : stats.profitFactor.status === "infinite"
                  ? "∞ · no losses"
                  : "Undefined"}
            </dd>
          </div>
          <div>
            <dt>Best winning trade</dt>
            <dd>
              {amount(stats.best?.realizedPnl ?? null, true)}
              {stats.best && <small>{stats.best.ticker}</small>}
            </dd>
          </div>
          <div>
            <dt>Worst losing trade</dt>
            <dd>
              {amount(stats.worst?.realizedPnl ?? null, true)}
              {stats.worst && <small>{stats.worst.ticker}</small>}
            </dd>
          </div>
          <div>
            <dt>Opening premium credits</dt>
            <dd>{amount(stats.openingCredits)}</dd>
          </div>
          <div>
            <dt>Closing premium credits</dt>
            <dd>{amount(stats.closingCredits)}</dd>
          </div>
          <div>
            <dt>Current open option positions</dt>
            <dd>
              {openCount}
              <small>Snapshot · before date/status filters</small>
            </dd>
          </div>
          <div>
            <dt>Winning / losing / breakeven</dt>
            <dd>
              {stats.winners} / {stats.losers} / {stats.breakeven}
              <small>{signedPercent(stats.winRate)} win rate</small>
            </dd>
          </div>
        </dl>
      </StatCard>
    </>
  );
}
