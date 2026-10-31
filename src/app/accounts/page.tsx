import { selectedPreview, previewsEnabled } from "@/server/config";
import { Suspense } from "react";
import { loadExchangeRate } from "@/server/exchange-rate";
import { loadPortfolio } from "@/server/load-portfolio";
import { AccountsDashboard } from "@/components/accounts/AccountsDashboard";
import { AccountsLoading } from "@/components/accounts/AccountsLoading";
import {
  accountsPreviews,
  createAccountsPreview,
  type AccountsPreviewState,
} from "@/dev/previews/accounts-preview";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { preview: requested } = await searchParams;
  const preview = selectedPreview(requested);
  if (
    previewsEnabled() &&
    accountsPreviews.includes(preview as AccountsPreviewState)
  )
    return (
      <AccountsDashboard
        {...createAccountsPreview(preview as AccountsPreviewState)}
        preview={preview as AccountsPreviewState}
      />
    );
  return (
    <Suspense fallback={<AccountsLoading />}>
      <LiveAccounts />
    </Suspense>
  );
}
async function LiveAccounts() {
  // Same read requests, sections, and investing-account scope as before.
  const [portfolio, rate] = await Promise.all([
    loadPortfolio(undefined, ["balances", "positions"]),
    loadExchangeRate(),
  ]);
  return <AccountsDashboard portfolio={portfolio} rate={rate} />;
}
