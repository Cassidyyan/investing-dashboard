import "server-only";

// Private API connection. Credentials stay here; callers receive only read methods.

import { Snaptrade, SnaptradeAuth } from "snaptrade-typescript-sdk";
export function getSnaptrade() {
  const clientId = process.env.SNAPTRADE_CLIENT_ID;
  const consumerKey = process.env.SNAPTRADE_CONSUMER_KEY;
  if (!clientId || !consumerKey) return null;
  const client = new Snaptrade({
    auth: SnaptradeAuth.personalApiKey({ clientId, consumerKey }),
  });
  // Expose only the read operations used by this application.
  const options = { timeout: 20_000 };
  return {
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
}
export type ReadClient = NonNullable<ReturnType<typeof getSnaptrade>>;
