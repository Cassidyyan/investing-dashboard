import "server-only";
import type { UniversalActivity } from "snaptrade-typescript-sdk";
import type { ReadClient } from "./snaptrade";
import { numeric } from "@/lib/financial/validation";
export class TransactionCoverageError extends Error {
  constructor(readonly code: string) {
    super(`Transaction coverage could not be verified (${code}).`);
  }
}
// One bounded reader for funding and security histories. No cache or new requests.
export async function* transactionRecords(
  accountId: string,
  client: Pick<ReadClient, "transactionPage">,
): AsyncGenerator<UniversalActivity> {
  const seen = new Set<string>();
  let expectedTotal: number | null = null;
  for (let page = 0; page < 10; page++) {
    const offset = page * 1000;
    const { data } = await client.transactionPage(accountId, offset, 1000);
    if (!data || !Array.isArray(data.data))
      throw new TransactionCoverageError("missing_page_records");
    if (data.data.length > 1000)
      throw new TransactionCoverageError("page_size_exceeded");
    for (const t of data.data) {
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
      if (seen.has(id)) throw new TransactionCoverageError("repeated_id");
      seen.add(id);
      yield t as UniversalActivity;
    }
    const total = numeric(data.pagination?.total);
    if (
      data.pagination?.total != null &&
      (total === null || !Number.isInteger(total) || total < 0)
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
    if (
      (expectedTotal !== null && received === expectedTotal) ||
      (expectedTotal === null && data.data.length < 1000)
    )
      return;
    if (data.data.length !== 1000)
      throw new TransactionCoverageError("incomplete_page");
  }
  throw new TransactionCoverageError("history_limit_exceeded");
}
