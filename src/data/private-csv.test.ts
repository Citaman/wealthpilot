import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { budgetCalendar, monthOf, monthRange } from "../domain/periods";
import { detectMapping } from "./importer/mapping";
import { buildPreview } from "./importer/preview";
import { parsedFile } from "./test-utils";

it.skipIf(!process.env.WEALTHPILOT_PRIVATE_CSV)(
  "valide le CSV privé sans publier ses opérations",
  () => {
    const file = parsedFile(
      readFileSync(process.env.WEALTHPILOT_PRIVATE_CSV!, "utf8"),
    );
    const mapping = detectMapping(file.fields);
    const first = buildPreview(
      file,
      mapping,
      {},
      { transactions: [], accounts: [] },
    );
    expect(first.errors).toEqual([]);
    expect(
      first.rows
        .filter((r) => r.status === "invalid")
        .map((r) => ({ line: r.index, error: r.reason })),
    ).toEqual([]);
    // Consolidated snapshot of 2026-10-04; older snapshots pass their own controls.
    expect(first.rows.length).toBe(
      Number(process.env.WEALTHPILOT_EXPECTED_ROWS ?? 1508),
    );
    expect(new Set(first.rows.map((r) => r.tx!.account)).size).toBe(
      Number(process.env.WEALTHPILOT_EXPECTED_ACCOUNTS ?? 3),
    );
    const transactions = first.rows.map((r, i) => ({
      ...r.tx!,
      id: String(i),
      batchId: "control",
    }));
    const again = buildPreview(
      file,
      mapping,
      {},
      { transactions, accounts: [] },
    );
    expect(again.counts.duplicate).toBe(first.rows.length);
    const calendar = budgetCalendar(transactions, "2026-10-05");
    expect(monthRange("2026-09", calendar)).toMatchObject({
      from: "2026-08-25",
      to: "2026-09-24",
    });
    expect(monthOf("2026-09-25", calendar)).toBe("2026-10");
    expect(calendar.observed.find((p) => p.month === "2026-10")?.date).toBe(
      "2026-09-25",
    );
    expect(calendar.observed.every((p) => p.date <= "2026-10-05")).toBe(true);
  },
);
