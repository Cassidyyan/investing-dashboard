import type { PositionView } from "./types";
export type PositionSortKey =
  "quantity" | "averageCost" | "price" | "value" | "return";
export type SortDirection = "ascending" | "descending";
export const positionSortLabels: Record<PositionSortKey, string> = {
  quantity: "Quantity",
  averageCost: "Avg. cost",
  price: "Last price",
  value: "Market value",
  return: "Net return",
};
function sortValue(
  position: PositionView,
  key: PositionSortKey,
): number | null {
  const value =
    key === "quantity"
      ? position.units
      : key === "averageCost"
        ? position.averageCost?.amount
        : key === "price"
          ? position.price.amount
          : key === "value"
            ? position.value.amount
            : position.unrealizedReturn?.amount;
  return value != null && Number.isFinite(value) ? value : null;
}
// Sort original numeric amounts, never formatted strings. Unknown values always
// come last, ties preserve the incoming order, and the source array is untouched.
export function sortPositions<T extends PositionView>(
  positions: readonly T[],
  key: PositionSortKey,
  direction: SortDirection,
): T[] {
  return positions
    .map((position, index) => ({ position, index }))
    .sort((a, b) => {
      const left = sortValue(a.position, key),
        right = sortValue(b.position, key);
      if (left === null) return right === null ? a.index - b.index : 1;
      if (right === null) return -1;
      if (left === right) return a.index - b.index;
      return direction === "descending" ? right - left : left - right;
    })
    .map((row) => row.position);
}
