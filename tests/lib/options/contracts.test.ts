import { expect, it } from "vitest";
import {
  parseOccSymbol,
  normalizeOptionContract,
  optionContractKey,
} from "@/lib/options/contracts";
it.each([
  ["SYNTH 261218C00150000", "CALL"],
  ["SYNTH261218P00012500", "PUT"],
])("parses call/put OCC components %s", (symbol, type) => {
  expect(parseOccSymbol(symbol, "2026-10-31")).toMatchObject({
    type,
    root: "SYNTH",
    expiration: "2026-12-18",
  });
});
it("preserves strike precision and does not invent a century or multiplier", () => {
  expect(parseOccSymbol("TEST261218C00150001", null)).toMatchObject({
    strike: "150.001",
    expiration: null,
  });
  const legacy = normalizeOptionContract(
    { symbol: "TEST261218C00150000", referenceDay: "2026-10-31" },
    "activity",
  );
  expect(legacy.type).toMatchObject({ status: "calculated", value: "CALL" });
  expect(legacy.multiplier.value).toBeNull();
  expect(legacy.strike.currency.value).toBeNull();
});
it.each(["10", "100", "150", "12.5"])(
  "retains explicit nonstandard positive multiplier %s",
  (multiplier) => {
    const c = normalizeOptionContract(
      {
        id: "contract",
        symbol: "TEST261218P00150000",
        type: "PUT",
        strike: "150",
        expiration: "2026-12-18",
        currency: "USD",
        multiplier,
      },
      "position",
    );
    expect(c.multiplier.value).toBe(multiplier);
    expect(c.strike.currency.value).toBe("USD");
    expect(optionContractKey(c)).not.toBeNull();
  },
);
it.each(["0", "-100", "bad", null])(
  "leaves invalid or missing multiplier %s unavailable",
  (multiplier) =>
    expect(
      normalizeOptionContract({ multiplier }, "position").multiplier.value,
    ).toBeNull(),
);
it("detects conflicting source fields rather than overriding them with OCC values", () => {
  const c = normalizeOptionContract(
    {
      symbol: "TEST261218C00150000",
      type: "PUT",
      strike: 140,
      expiration: "2026-12-18",
    },
    "activity",
  );
  expect(c.issues[0].code).toBe("contract_symbol_conflict");
  expect(c.type.value).toBe("PUT");
  expect(optionContractKey(c)).toBeNull();
});
it("keeps invalid dates unrecognized and handles missing contract fields safely", () => {
  expect(parseOccSymbol("TEST260230C00150000", "2026-01-01")).toBeNull();
  expect(parseOccSymbol("not an OCC symbol", null)).toBeNull();
  const c = normalizeOptionContract(
    { symbol: "TEST", expiration: "invalid" },
    "activity",
  );
  expect(c.expiration.status).toBe("unsupported");
  expect(optionContractKey(c)).toBeNull();
});
