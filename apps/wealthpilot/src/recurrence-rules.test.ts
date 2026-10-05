import { describe, it, expect } from "vitest";
import { activeRecurrences, withEstimates } from "./intelligence";
import { emptySnapshot, type Snapshot } from "./types";
import { validateBackup } from "./store";
const fixture = (): Snapshot => ({
  ...structuredClone(emptySnapshot),
  accounts: [{ id: "A" }],
  transactions: ["07", "08", "09"].map((m, i) => ({
    id: String(i),
    batchId: "b",
    account: "A",
    date: `2026-${m}-06`,
    amount: -1000,
    label: "Water",
    merchant: "Water",
    category: "Bills",
    internal: false,
    raw: {},
    fingerprint: "fixture",
  })),
});
describe("Confirmed recurrence rules and individual occurrences", () => {
  it("confirmation replaces suggestion and changes only future occurrences", () => {
    const s = fixture(),
      detected = activeRecurrences(s, "2026-10-04")[0],
      past = structuredClone(s.transactions);
    s.preferences.recurrenceRules = [
      {
        id: "r",
        sourceKey: detected.key,
        name: "Water",
        account: "A",
        amount: -1200,
        category: "Bills",
        frequency: "monthly",
        next: "2026-10-08",
      },
    ];
    const out = withEstimates(s, "2026-11-30", "2026-10-04");
    expect(
      out.dues.map((d) => [d.date, d.amount, d.recurrenceConfirmed]),
    ).toEqual([
      ["2026-10-08", -1200, true],
      ["2026-11-08", -1200, true],
    ]);
    expect(withEstimates(out, "2026-11-30", "2026-10-04").dues).toEqual(
      out.dues,
    );
    expect(s.transactions).toEqual(past);
  });
  it("pause, end date and ignored occurrence affect only their scope", () => {
    const s = fixture();
    s.transactions = [];
    s.preferences.recurrenceRules = [
      {
        id: "r",
        name: "Water",
        account: "A",
        amount: -1200,
        category: "Bills",
        frequency: "weekly",
        next: "2026-10-06",
        end: "2026-10-20",
      },
    ];
    const first = withEstimates(s, "2026-11-30", "2026-10-04");
    expect(first.dues.map((d) => d.date)).toEqual([
      "2026-10-06",
      "2026-10-13",
      "2026-10-20",
    ]);
    s.preferences.ignoredOccurrences = [first.dues[0].id];
    expect(
      withEstimates(s, "2026-11-30", "2026-10-04").dues.map((d) => d.date),
    ).toEqual(["2026-10-13", "2026-10-20"]);
    s.preferences.recurrenceRules[0].paused = true;
    expect(withEstimates(s, "2026-11-30", "2026-10-04").dues).toEqual([]);
  });
  it("a moved manual override does not swallow the following scheduled occurrence", () => {
    const s = fixture();
    s.transactions = [];
    s.preferences.recurrenceRules = [
      {
        id: "r",
        name: "Water",
        account: "A",
        amount: -1200,
        category: "Bills",
        frequency: "weekly",
        next: "2026-10-06",
      },
    ];
    const original = withEstimates(s, "2026-10-20", "2026-10-04").dues[0];
    s.preferences.ignoredOccurrences = [original.id];
    s.dues = [
      {
        id: "override",
        originOccurrenceId: original.id,
        recurrenceKey: original.recurrenceKey,
        label: "Water",
        account: "A",
        amount: -1200,
        date: "2026-10-12",
      },
    ];
    const out = withEstimates(s, "2026-10-20", "2026-10-04");
    expect(out.dues.map((d) => d.date).sort()).toEqual([
      "2026-10-12",
      "2026-10-13",
      "2026-10-20",
    ]);
    // Re-enabling the original suggestion cannot duplicate an explicit exception.
    s.preferences.ignoredOccurrences = [];
    expect(
      withEstimates(s, "2026-10-20", "2026-10-04")
        .dues.map((d) => d.date)
        .sort(),
    ).toEqual(["2026-10-12", "2026-10-13", "2026-10-20"]);
  });
  it("advances old monthly rules without losing month-end cadence", () => {
    const s = fixture();
    s.transactions = [];
    s.preferences.recurrenceRules = [
      {
        id: "r",
        name: "Pay",
        account: "A",
        amount: 100000,
        category: "Salary",
        frequency: "monthly",
        next: "2020-01-31",
      },
    ];
    expect(
      withEstimates(s, "2026-03-31", "2026-02-01").dues.map((d) => d.date),
    ).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });
  it("validates recurrence, scenario and household settings before restore", () => {
    const s = { ...structuredClone(emptySnapshot), accounts: [{ id: "A" }] };
    s.preferences.recurrenceRules = [
      {
        id: "r",
        name: "Pay",
        account: "A",
        amount: 100000,
        category: "Salary",
        frequency: "monthly",
        next: "2026-10-26",
      },
    ];
    s.preferences.scenarios = [
      {
        id: "sc",
        name: "Prudent",
        account: "",
        incomeDelay: 5,
        expenseIncrease: 20,
      },
    ];
    s.preferences.householdPlan = {
      members: [{ name: "First", account: "A", share: 100 }],
    };
    expect(() =>
      validateBackup({ format: "wealthpilot-next", version: 1, data: s }),
    ).not.toThrow();
    s.preferences.recurrenceRules[0].end = "2026-10-01";
    expect(() =>
      validateBackup({ format: "wealthpilot-next", version: 1, data: s }),
    ).toThrow();
  });
});
