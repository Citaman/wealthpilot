import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseCSV, detectMapping, previewImport } from "./importer";
import { budgetCalendar, budgetCycle, budgetCycleKey } from "./periods";
it.skipIf(!process.env.WEALTHPILOT_PRIVATE_CSV)(
  "valide le CSV privé sans publier ses opérations",
  () => {
    const text = readFileSync(process.env.WEALTHPILOT_PRIVATE_CSV!, "utf8");
    const parsed = parseCSV(text);
    expect(parsed.errors).toEqual([]);
    const candidates = previewImport(
      parsed,
      detectMapping(parsed.fields),
      "",
      [],
    );
    const errors = candidates.filter((c) => c.error);
    expect(errors.map((c) => ({ line: c.row, error: c.error }))).toEqual([]);
    // Current consolidated snapshot (2026-10-04). Older snapshots can supply
    // explicit controls without weakening the count/account reconciliation.
    expect(candidates.length).toBe(
      Number(process.env.WEALTHPILOT_EXPECTED_ROWS ?? 1508),
    );
    expect(new Set(candidates.map((c) => c.transaction?.account)).size).toBe(
      Number(process.env.WEALTHPILOT_EXPECTED_ACCOUNTS ?? 3),
    );
    const reimport = previewImport(
      parsed,
      detectMapping(parsed.fields),
      "",
      candidates.map((c, index) => ({
        ...c.transaction!,
        id: `control-${index}`,
        batchId: "control",
      })),
    );
    expect(reimport.every((c) => c.duplicate && !c.error)).toBe(true);
    const transactions = candidates.map((c, i) => ({
      ...c.transaction!,
      id: String(i),
      batchId: "control",
    }));
    const calendar = budgetCalendar(transactions, "2026-10-05");
    expect(budgetCycle("2026-09", calendar)).toEqual({
      from: "2026-08-25",
      to: "2026-09-24",
    });
    expect(budgetCycleKey("2026-09-25", calendar)).toBe("2026-10");
    expect(calendar.observed.find((p) => p.month === "2026-10")?.date).toBe(
      "2026-09-25",
    );
    expect(calendar.observed.every((p) => p.date <= "2026-10-05")).toBe(true);
  },
);
