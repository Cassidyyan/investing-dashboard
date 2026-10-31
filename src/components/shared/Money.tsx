import type { Money as MoneyData } from "@/lib/types";
import { money, cashMoney, signedMoney, signedAmount } from "@/lib/format";
import { PrivateValue } from "./BalancePrivacy";
// One privacy-aware currency renderer; formatting and calculations stay unchanged.
export function Money({
  value,
  cash = false,
  signed = false,
  showCurrency = true,
  zeroAsDash = false,
  missingAsDash = false,
}: {
  value: MoneyData;
  cash?: boolean;
  signed?: boolean;
  showCurrency?: boolean;
  zeroAsDash?: boolean;
  missingAsDash?: boolean;
}) {
  const format = signed
    ? showCurrency
      ? signedMoney
      : signedAmount
    : cash
      ? cashMoney
      : money;
  return (
    <PrivateValue>
      {(value.amount === null && missingAsDash) ||
      (value.amount === 0 && zeroAsDash) ? (
        <span aria-label={value.amount === 0 ? "Zero" : "Unavailable"}>—</span>
      ) : (
        format(value)
      )}
    </PrivateValue>
  );
}
