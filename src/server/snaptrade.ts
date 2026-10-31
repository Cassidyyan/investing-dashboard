import "server-only";

// Private API connection. Credentials stay here; callers receive only read methods.

import { createHash } from "node:crypto";
import { createRequestProtection } from "./request-protection";
import { Snaptrade, SnaptradeAuth } from "snaptrade-typescript-sdk";

let protectionScope = "";
let protect = createRequestProtection();
const adapterScopes = new WeakMap<object, object>();
export function historyCacheScope(client: object): object {
  const page = Reflect.get(client, "transactionPage");
  return (
    adapterScopes.get(client) ||
    (typeof page === "function" ? adapterScopes.get(page) || page : client)
  );
}

export function getSnaptrade() {
  const clientId = process.env.SNAPTRADE_CLIENT_ID;
  const consumerKey = process.env.SNAPTRADE_CONSUMER_KEY;
  if (!clientId || !consumerKey) return null;
  const scope = createHash("sha256")
    .update(clientId)
    .update("\0")
    .update(consumerKey)
    .digest("hex");
  if (scope !== protectionScope) {
    protectionScope = scope;
    protect = createRequestProtection();
  }
  const guard = protect;
  const client = new Snaptrade({
    auth: SnaptradeAuth.personalApiKey({ clientId, consumerKey }),
  });
  // Expose only the read operations used by this application.
  const options = { timeout: 20_000 };
  const reads = {
    accounts: () => client.accountInformation.listUserAccounts({}, options),
    connections: () =>
      client.connections.listBrokerageAuthorizations({}, options),
    balances: (accountId: string) =>
      client.accountInformation.getUserAccountBalance({ accountId }, options),
    positions: (accountId: string) =>
      client.accountInformation.getAllAccountPositions({ accountId }, options),
    orders: (accountId: string) =>
      client.accountInformation.getUserAccountRecentOrders(
        { accountId },
        options,
      ),
    // History is beta/opt-in and limited to one year by SnapTrade.
    history: (accountId: string) =>
      client.accountInformation.getAccountBalanceHistory(
        { accountId },
        options,
      ),
    returns: (accountId: string) =>
      client.accountInformation.getUserAccountReturnRates(
        { accountId },
        options,
      ),
    activities: (accountId: string) =>
      client.accountInformation.getAccountActivities(
        {
          accountId,
          limit: 25,
          offset: 0,
          startDate: new Date(Date.now() - 90 * 86400000)
            .toISOString()
            .slice(0, 10),
        },
        options,
      ),
    // No date filter: lifetime analysis needs every transaction known to SnapTrade.
    transactionPage: (accountId: string, offset: number, limit: number) =>
      client.accountInformation.getAccountActivities(
        { accountId, offset, limit },
        options,
      ),
  };
  // Endpoint + arguments identify identical reads across simultaneous page loads.
  const adapter = Object.fromEntries(
    Object.entries(reads).map(([method, request]) => [
      method,
      (...args: unknown[]) =>
        guard(JSON.stringify([method, ...args]), () =>
          (request as (...args: unknown[]) => Promise<unknown>)(...args),
        ),
    ]),
  ) as typeof reads;
  adapterScopes.set(adapter, guard);
  adapterScopes.set(adapter.transactionPage, guard);
  return adapter;
}
export type ReadClient = NonNullable<ReturnType<typeof getSnaptrade>>;
