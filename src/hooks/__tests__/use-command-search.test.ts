import { describe, expect, it } from "vitest";
import { matchesTransactionDirection } from "../use-command-search";

describe("matchesTransactionDirection", () => {
  it("uses the explicit transaction direction instead of the unsigned amount", () => {
    const debit = { direction: "debit" as const, amount: 854 };
    const credit = { direction: "credit" as const, amount: 3_690.24 };

    expect(matchesTransactionDirection(debit, "debit")).toBe(true);
    expect(matchesTransactionDirection(debit, "credit")).toBe(false);
    expect(matchesTransactionDirection(credit, "credit")).toBe(true);
    expect(matchesTransactionDirection(credit, "debit")).toBe(false);
  });

  it("does not filter when no direction is requested", () => {
    expect(matchesTransactionDirection({ direction: "debit" }, null)).toBe(true);
  });
});
