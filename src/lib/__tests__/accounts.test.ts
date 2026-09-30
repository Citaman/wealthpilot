import { describe, expect, it } from "vitest";
import type { Account } from "../db";
import { getAccountTrust } from "../accounts";

const account = {
  id: 1, name: "Compte", type: "checking", balance: 10, currency: "EUR", institution: "SG",
  color: "#000", isActive: true, initialBalance: 0, initialBalanceDate: "2026-09-01",
  createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-28T12:00:00Z",
} satisfies Account;

describe("confiance du solde", () => {
  it("signale un compte récent comme fiable", () => {
    expect(getAccountTrust(account, new Date("2026-09-29T12:00:00Z"))).toMatchObject({ status: "fresh", asOf: "2026-09-28" });
  });
  it("signale un compte ancien à actualiser", () => {
    expect(getAccountTrust(account, new Date("2026-10-20T12:00:00Z"))).toMatchObject({ status: "stale" });
  });
});
