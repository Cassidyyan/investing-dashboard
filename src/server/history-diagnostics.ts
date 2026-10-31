import "server-only";
import { getConfig } from "./config";
import { getSnaptrade, type ReadClient } from "./snaptrade";
import { loadTransactionSnapshot } from "./transaction-pages";
import { transactionSync } from "./history-quality";
import { normalizeTransaction } from "./normalize-transactions";
import { buildOptionsLedger } from "@/lib/options/ledger";
import { calendarToday } from "@/lib/performance/performance";
import { calendarDay, nonEmptyText } from "@/lib/financial/validation";
// Deliberate whitelist: never return account IDs/names/numbers, ticker values,
// descriptions, cash amounts, credentials, payloads or exception messages.
export async function historyDiagnostics(
  client: ReadClient | null = getSnaptrade(),
  settings: { accountIndices?: readonly number[]; valuations?: boolean } = {},
) {
  if (!client)
    return {
      configured: false,
      accounts: [],
      error: "Local credentials are not configured.",
    };
  const [accountRead, connectionRead] = await Promise.allSettled([
    client.accounts(),
    client.connections(),
  ]);
  if (
    accountRead.status !== "fulfilled" ||
    !Array.isArray(accountRead.value.data)
  )
    return {
      configured: true,
      accounts: [],
      error: "Account list unavailable.",
    };
  const connections =
    connectionRead.status === "fulfilled" &&
    Array.isArray(connectionRead.value.data)
      ? connectionRead.value.data
      : [];
  const accounts = [];
  let limited = false;
  for (const [index, account] of accountRead.value.data.entries()) {
    if (settings.accountIndices && !settings.accountIndices.includes(index))
      continue;
    const alias = `Account ${index + 1}`;
    if (!account || !nonEmptyText(account.id)) {
      accounts.push({ alias, error: "Account identity unavailable." });
      continue;
    }
    const connection = connections.find(
      (c) => c.id === account.brokerage_authorization,
    );
    const sync = transactionSync(account.sync_status?.transactions);
    if (limited) {
      accounts.push({ alias, sync, error: "Not requested after rate limit." });
      continue;
    }
    const snapshot = await loadTransactionSnapshot(account.id, client, {
      sync,
    });
    limited = snapshot.coverage.errorCode === "rate_limited";
    let options: {
      completed: number;
      incomplete: number;
      open: number;
    } | null = null;
    let normalization: {
      rawSymbolLost: number;
      optionIdLost: number;
      parsedContractFields: number;
    } | null = null;
    try {
      const records = snapshot.records.map((t) =>
        normalizeTransaction(t, account.id),
      );
      const ledger = buildOptionsLedger(
        [
          {
            accountId: account.id,
            records,
            issues:
              snapshot.coverage.status === "complete" &&
              sync.initialSyncCompleted !== false
                ? []
                : ["Incomplete source history"],
          },
        ],
        calendarToday(),
        getConfig().settings.optionsCurrency,
      );
      options = {
        completed: ledger.trades.filter((t) => t.status === "closed").length,
        incomplete: ledger.trades.filter((t) => t.status === "needs-review")
          .length,
        open: ledger.trades.filter(
          (t) => t.status === "open" || t.status === "partial",
        ).length,
      };
      normalization = {
        rawSymbolLost: records.filter(
          (r, i) =>
            nonEmptyText(snapshot.records[i].symbol?.raw_symbol) &&
            !r.sourceMetadata?.rawSecuritySymbol,
        ).length,
        optionIdLost: records.filter(
          (r, i) =>
            nonEmptyText(snapshot.records[i].option_symbol?.id) &&
            !r.option?.id,
        ).length,
        parsedContractFields: records.reduce(
          (n, r) =>
            n +
            (r.option
              ? [
                  r.option.type,
                  r.option.strike.amount,
                  r.option.expiration,
                ].filter((f) => f.status === "calculated").length
              : 0),
          0,
        ),
      };
    } catch {
      /* A safe explicit unavailable diagnostic, not an invented clean bill. */
    }
    let valuation: {
      status: string;
      earliest?: string | null;
      latest?: string | null;
      observations?: number;
      reason?: string;
    } = { status: "not-requested" };
    if (
      settings.valuations !== false &&
      !limited &&
      account.account_category !== "DEPOSIT" &&
      account.account_category !== "LOC"
    )
      try {
        const { data } = await client.history(account.id);
        const days = (Array.isArray(data.history) ? data.history : [])
          .map((p) => calendarDay(p.date))
          .filter((d): d is string => d !== null)
          .sort();
        valuation = {
          status: "available-beta",
          earliest: days[0] || null,
          latest: days.at(-1) || null,
          observations: days.length,
        };
      } catch (error) {
        const status = (error as { response?: { status?: number } } | null)
          ?.response?.status;
        if (status === 429) limited = true;
        valuation = {
          status: "unavailable",
          reason:
            status === 429
              ? "rate-limited"
              : status === 403
                ? "access-denied"
                : "source-unavailable",
        };
      }
    accounts.push({
      alias,
      category:
        typeof account.account_category === "string"
          ? account.account_category
          : "unknown",
      connection:
        connection?.disabled === true
          ? "disabled"
          : connection?.disabled === false
            ? "connected"
            : "unknown",
      sync,
      coverage: snapshot.coverage,
      earlierHistoryIndicated: !!(
        sync.firstTransactionDate &&
        snapshot.coverage.earliest &&
        sync.firstTransactionDate < snapshot.coverage.earliest
      ),
      options,
      actionEvidence: {
        explicitDescriptionActions: snapshot.records.filter(
          (t) =>
            t.option_symbol &&
            /\b(?:BUY|BOUGHT|SELL|SOLD)\s+TO\s+(?:OPEN|CLOSE)\b/i.test(
              typeof t.description === "string" ? t.description : "",
            ),
        ).length,
        knownTopLevelActions: snapshot.records.filter((t) =>
          [
            "BUY_TO_OPEN",
            "BUY_TO_CLOSE",
            "SELL_TO_OPEN",
            "SELL_TO_CLOSE",
          ].includes(String(t.type)),
        ).length,
        supplementalActionFields: snapshot.records.filter((t) =>
          [t.action, t.side, t.open_close].some((v) =>
            [
              "BUY_TO_OPEN",
              "BUY_TO_CLOSE",
              "SELL_TO_OPEN",
              "SELL_TO_CLOSE",
            ].includes(String(v)),
          ),
        ).length,
        optionFeeZero: snapshot.records.filter(
          (t) => t.option_symbol && t.fee === 0,
        ).length,
        optionFeeNonzero: snapshot.records.filter(
          (t) => t.option_symbol && typeof t.fee === "number" && t.fee !== 0,
        ).length,
      },
      normalization,
      valuation,
    });
  }
  return {
    configured: true,
    retrievedAt: new Date().toISOString(),
    accounts,
    error: null,
  };
}
