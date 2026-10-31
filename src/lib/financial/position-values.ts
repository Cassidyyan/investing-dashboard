import {
  decimal,
  compareDecimal,
  multiplyDecimal,
  subtractDecimal,
  absoluteDecimal,
} from "./decimal";
// The existing per-share formulas, evaluated in base ten before numeric UI projection.
export function positionValues(input: {
  units: unknown;
  price: unknown;
  cost: unknown;
  multiplier: unknown;
}) {
  const zero = decimal("0")!,
    units = decimal(input.units),
    price = decimal(input.price),
    cost = decimal(input.cost),
    multiplier = decimal(input.multiplier);
  const validPrice = price !== null && compareDecimal(price, zero) >= 0;
  const validMultiplier =
    multiplier !== null && compareDecimal(multiplier, zero) > 0;
  const marketValue =
    units !== null && validPrice && validMultiplier
      ? multiplyDecimal(multiplyDecimal(units, price!), multiplier!)
      : null;
  const validCost = cost !== null && compareDecimal(cost, zero) >= 0;
  const unrealizedReturn =
    marketValue !== null && validCost
      ? multiplyDecimal(
          multiplyDecimal(subtractDecimal(price!, cost!), units!),
          multiplier!,
        )
      : null;
  const invested =
    units !== null && validCost && validMultiplier
      ? absoluteDecimal(
          multiplyDecimal(multiplyDecimal(cost!, units), multiplier!),
        )
      : null;
  return { marketValue, unrealizedReturn, invested };
}
