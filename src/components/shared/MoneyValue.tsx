import { Money } from "./Money";
export function MoneyValue({
  amount,
  currency,
  cash = false,
}: {
  amount: number | null;
  currency: string;
  cash?: boolean;
}) {
  return <Money value={{ amount, currency }} cash={cash} />;
}
