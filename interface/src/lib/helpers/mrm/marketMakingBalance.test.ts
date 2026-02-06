import { describe, expect, it } from "vitest";
import {
  formatBalanceForDisplay,
  getAssetBalanceBySymbol,
  getBalanceAutofillAmount,
} from "./marketMakingBalance";

describe("getAssetBalanceBySymbol", () => {
  it("returns 0 when wallet is empty", () => {
    expect(getAssetBalanceBySymbol(undefined, "BTC")).toBe("0");
  });

  it("returns balance when exact symbol exists", () => {
    const wallet = {
      balances: [
        {
          balance: "1.23",
          details: { symbol: "BTC" },
        },
      ],
    };

    expect(getAssetBalanceBySymbol(wallet, "BTC")).toBe("1.23");
  });

  it("matches chain-suffixed symbols like USDT@ERC20", () => {
    const wallet = {
      balances: [
        {
          balance: "42",
          details: { symbol: "USDT@ERC20" },
        },
      ],
    };

    expect(getAssetBalanceBySymbol(wallet, "USDT")).toBe("42");
  });
});

describe("formatBalanceForDisplay", () => {
  it("keeps balance when under max decimals", () => {
    expect(formatBalanceForDisplay("1.2345", 8)).toBe("1.2345");
  });

  it("caps to max decimals when too long", () => {
    expect(formatBalanceForDisplay("1.2345678912", 8)).toBe("1.23456789");
  });
});

describe("getBalanceAutofillAmount", () => {
  it("returns 0 for missing balance", () => {
    expect(getBalanceAutofillAmount(undefined)).toBe("0");
  });

  it("returns balance string for valid value", () => {
    expect(getBalanceAutofillAmount("12.5")).toBe("12.5");
  });
});
