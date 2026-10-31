import "server-only";
import { createHash } from "node:crypto";
import type { UniversalActivity } from "snaptrade-typescript-sdk";
import { historyCacheScope, type ReadClient } from "./snaptrade";
import { numeric } from "@/lib/financial/validation";
import type {
  TransactionCoverage,
  TransactionSync,
} from "@/lib/financial/history-coverage";
import { historyQuality } from "./history-quality";
export class TransactionCoverageError extends Error {
  constructor(readonly code: string) {
    super(`Transaction coverage could not be verified (${code}).`);
  }
}
export type TransactionSnapshot = {
  records: readonly UniversalActivity[];
  coverage: TransactionCoverage;
};
type Entry = {
  version: string;
  promise: Promise<TransactionSnapshot>;
  expires: number;
  records: number;
};
const scopes = new WeakMap<object, Map<string, Entry>>();
const CACHE_MS = 60_000,
  PARTIAL_CACHE_MS = 10_000,
  MAX_CACHED_RECORDS = 100_000;
// Stable JSON fingerprints detect changed duplicate identities, never duplicate
// distinct executions simply because their monetary fields happen to match.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => `${JSON.stringify(key)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
async function retrieve(
  accountId: string,
  client: Pick<ReadClient, "transactionPage">,
  maxDurationMs: number,
): Promise<TransactionSnapshot> {
  const records: UniversalActivity[] = [],
    seen = new Map<string, string>();
  let expectedTotal: number | null = null,
    rawRecords = 0,
    pages = 0,
    duplicates = 0,
    errorCode: string | null = null;
  const started = Date.now();
  try {
    // No date or record-count ceiling. A time budget and no-progress detection
    // stop pathological reads without ever calling partial history complete.
    for (let offset = 0; ;) {
      if (pages && Date.now() - started >= maxDurationMs)
        throw new TransactionCoverageError("time_budget_exceeded");
      const { data } = await client.transactionPage(accountId, offset, 1000);
      pages++;
      if (!data || !Array.isArray(data.data))
        throw new TransactionCoverageError("missing_page_records");
      if (data.data.length > 1000)
        throw new TransactionCoverageError("page_size_exceeded");
      if (
        data.pagination?.offset != null &&
        numeric(data.pagination.offset) !== offset
      )
        throw new TransactionCoverageError("offset_mismatch");
      const before = records.length;
      for (const t of data.data) {
        rawRecords++;
        if (!t || typeof t.id !== "string" || !t.id.trim())
          throw new TransactionCoverageError("missing_id");
        const account = t.account;
        if (
          account != null &&
          (typeof account !== "object" ||
            Array.isArray(account) ||
            ("id" in account && account.id != null && account.id !== accountId))
        )
          throw new TransactionCoverageError("account_scope_mismatch");
        const id = t.id.trim();
        const fingerprint = createHash("sha256")
          .update(canonical({ ...t, id }))
          .digest("hex");
        if (seen.has(id)) {
          if (seen.get(id) !== fingerprint)
            throw new TransactionCoverageError("conflicting_id");
          duplicates++;
          continue;
        }
        seen.set(id, fingerprint);
        records.push(t as UniversalActivity);
      }
      const total = numeric(data.pagination?.total);
      if (
        data.pagination?.total != null &&
        (total === null || !Number.isSafeInteger(total) || total < 0)
      )
        throw new TransactionCoverageError("invalid_total");
      if (total !== null) {
        if (expectedTotal !== null && total !== expectedTotal)
          throw new TransactionCoverageError("total_changed");
        expectedTotal = total;
      }
      const received = offset + data.data.length;
      if (expectedTotal !== null && received > expectedTotal)
        throw new TransactionCoverageError("total_smaller_than_records");
      if (offset > 0 && data.data.length > 0 && records.length === before)
        throw new TransactionCoverageError("no_progress");
      if (
        (expectedTotal !== null && received === expectedTotal) ||
        (expectedTotal === null && data.data.length === 0)
      )
        break;
      if (data.data.length === 0)
        throw new TransactionCoverageError("incomplete_page");
      if (records.length === before)
        throw new TransactionCoverageError("no_progress");
      if (!Number.isSafeInteger(received))
        throw new TransactionCoverageError("unsafe_offset");
      offset = received;
    }
  } catch (error) {
    const status = (error as { response?: { status?: number } } | null)
      ?.response?.status;
    errorCode =
      error instanceof TransactionCoverageError
        ? error.code
        : status === 429
          ? "rate_limited"
          : "request_failed";
  }
  return {
    records,
    coverage: {
      status: errorCode ? "partial" : "complete",
      records: records.length,
      rawRecords,
      expectedTotal,
      pages,
      duplicates,
      errorCode,
      retrievedAt: new Date().toISOString(),
      cache: "fresh",
      ...historyQuality(records),
    },
  };
}
export async function loadTransactionSnapshot(
  accountId: string,
  client: Pick<ReadClient, "transactionPage">,
  options: {
    force?: boolean;
    maxDurationMs?: number;
    sync?: TransactionSync;
  } = {},
): Promise<TransactionSnapshot> {
  const duration = options.maxDurationMs ?? 120_000;
  if (!Number.isFinite(duration) || duration <= 0)
    throw new RangeError("A positive history read budget is required.");
  const scope = historyCacheScope(client);
  let cache = scopes.get(scope);
  if (!cache) {
    cache = new Map();
    scopes.set(scope, cache);
  }
  const existing = cache.get(accountId);
  const version = JSON.stringify(options.sync || null);
  if (
    existing &&
    existing.version === version &&
    (existing.expires === Infinity ||
      (!options.force && Date.now() < existing.expires))
  ) {
    const snapshot = await existing.promise;
    return { ...snapshot, coverage: { ...snapshot.coverage, cache: "cached" } };
  }
  const entry: Entry = {
    version,
    promise: retrieve(accountId, client, duration),
    expires: Infinity,
    records: 0,
  };
  cache.set(accountId, entry);
  try {
    const snapshot = await entry.promise;
    entry.expires =
      Date.now() +
      (snapshot.coverage.status === "complete" ? CACHE_MS : PARTIAL_CACHE_MS);
    entry.records = snapshot.records.length;
    // Credentials, records and fingerprints remain in process memory only.
    for (const [key, value] of cache)
      if (value !== entry && value.expires < Date.now()) cache.delete(key);
    for (const [key, value] of cache) {
      if (
        cache.size <= 100 &&
        [...cache.values()].reduce((sum, e) => sum + e.records, 0) <=
          MAX_CACHED_RECORDS
      )
        break;
      if (value.expires !== Infinity) cache.delete(key);
    }
    return snapshot;
  } catch (error) {
    if (cache.get(accountId) === entry) cache.delete(accountId);
    throw error;
  }
}
export async function* transactionRecords(
  accountId: string,
  client: Pick<ReadClient, "transactionPage">,
  onCoverage?: (coverage: TransactionCoverage) => void,
  sync?: TransactionSync,
): AsyncGenerator<UniversalActivity> {
  const snapshot = await loadTransactionSnapshot(accountId, client, { sync });
  onCoverage?.(snapshot.coverage);
  yield* snapshot.records;
  if (snapshot.coverage.status !== "complete") {
    if (snapshot.coverage.errorCode === "rate_limited")
      throw Object.assign(new TransactionCoverageError("rate_limited"), {
        response: { status: 429 },
      });
    throw new TransactionCoverageError(
      snapshot.coverage.errorCode || "incomplete_history",
    );
  }
}
