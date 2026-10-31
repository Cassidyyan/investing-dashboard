import { expect, it } from "vitest";
import {
  decimal,
  addDecimal,
  subtractDecimal,
  multiplyDecimal,
  compareDecimal,
  decimalNumber,
} from "@/lib/financial/decimal";
import {
  currencyField,
  decimalField,
  financialDate,
} from "@/lib/financial/fields";
const d = (value: string) => decimal(value)!;
it("adds monetary decimals exactly without binary floating-point drift", () => {
  expect(addDecimal(d("0.1"), d("0.2"))).toBe("0.3");
  expect(subtractDecimal(d("100.00"), d("99.99"))).toBe("0.01");
  expect(multiplyDecimal(d("1.125"), d("150"))).toBe("168.75");
  expect(addDecimal(d("9007199254740993.01"), d("0.01"))).toBe(
    "9007199254740993.02",
  );
});
it("normalizes signs, exponent notation and insignificant zeroes without rounding", () => {
  expect(decimal("-0.000")).toBe("0");
  expect(decimal("001.2500")).toBe("1.25");
  expect(decimal("1.23e-4")).toBe("0.000123");
  expect(decimal(1e21)).toBe("1000000000000000000000");
  expect(compareDecimal(d("-1.2"), d("-1.1"))).toBe(-1);
  expect(decimalNumber(null)).toBeNull();
});
it.each([
  null,
  undefined,
  "",
  " ",
  "0x10",
  Infinity,
  NaN,
  {},
  "1e99999",
  "1".repeat(101),
])("rejects missing, nondecimal or unbounded input %s", (value) =>
  expect(decimal(value)).toBeNull(),
);
it("separates missing, unsupported and confirmed fields, retaining provenance", () => {
  const source = { provider: "snaptrade" as const, field: "test.amount" };
  expect(decimalField(null, source)).toMatchObject({
    status: "missing",
    value: null,
  });
  expect(decimalField("bad", source)).toMatchObject({
    status: "unsupported",
    value: null,
  });
  expect(decimalField(0, source)).toMatchObject({
    status: "confirmed",
    value: "0",
    provenance: source,
  });
  expect(currencyField(" cad ", source).value).toBe("CAD");
  expect(currencyField("unknown", source).status).toBe("unsupported");
});
it("does not invent intraday precision or accept malformed timestamps", () => {
  expect(financialDate("2026-10-31")).toMatchObject({
    day: "2026-10-31",
    instant: null,
    precision: "day",
  });
  expect(financialDate("2026-10-31T00:00:00Z").precision).toBe("day");
  expect(financialDate("2026-10-31T10:00:00-04:00").instant).toBe(
    "2026-10-31T14:00:00.000Z",
  );
  for (const raw of ["2026-02-30", "2026-10-31Tbad", "2026-10-31T24:00:00Z"])
    expect(financialDate(raw).precision).toBe("invalid");
});

it("accepts fractional decimal notation without accepting hexadecimal coercions", () => {
  expect(decimal(".125")).toBe("0.125");
  expect(decimal("1.")).toBe("1");
  expect(decimal("-.5e2")).toBe("-50");
});
