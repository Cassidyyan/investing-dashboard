import { PrivateValue } from "@/components/shared/BalancePrivacy";
import { money, cashMoney } from "@/lib/format";
export function MoneyValue({
  amount,
  currency,
  cash = false,
}: {
  amount: number | null;
  currency: string;
  cash?: boolean;
}) {
  return (
    <PrivateValue placeholder="••••">
      {(cash ? cashMoney : money)({ amount, currency })}
    </PrivateValue>
  );
}
