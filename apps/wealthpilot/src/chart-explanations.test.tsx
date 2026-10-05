import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { BalanceChart } from "./Chart";
import { notableDays } from "./chart-events";
import { detectRecurrences, withEstimates } from "./intelligence";
import { selectDashboard } from "./domain";
import { emptySnapshot, type Transaction } from "./types";

const tx = (
  id: string,
  date: string,
  amount: number,
  account: string,
  merchant: string,
  internal = false,
): Transaction => ({
  id,
  date,
  amount,
  account,
  merchant,
  label: merchant,
  internal,
  category: "À catégoriser",
  batchId: "fixture",
  fingerprint: id,
  raw: {},
});
const history = () =>
  ["06", "07", "08", "09"].flatMap((m, i) => [
    tx(
      "A" + m,
      `2026-${m}-26`,
      [200000, 202000, 300000, 201000][i],
      "A",
      "Atelier Alpha",
    ),
    tx(
      "B" + m,
      `2026-${m}-28`,
      180000,
      "B",
      `VIR RECU DE: Studio Lune MOTIF: PERIOD ${m} REF: ${i}`,
    ),
    tx("C" + m, `2026-${m}-05`, 40000, "B", "Caisse allocations"),
  ]);
describe("Explain every relevant household movement without guessing income", () => {
  it("keeps two independently evidenced incomes plus benefit, despite one exceptional bonus", () => {
    const rows = history();
    const recurrences = detectRecurrences(rows, "2026-10-04");
    expect(recurrences).toHaveLength(3);
    expect(recurrences.map((r) => r.amount).sort((a, b) => a - b)).toEqual([
      40000, 180000, 202000,
    ]);
    expect(recurrences.find((r) => r.account === "A")!.confidence).toBe(65);
    const s = structuredClone(emptySnapshot);
    s.transactions = rows;
    const forecast = withEstimates(s, "2026-10-31", "2026-10-04");
    expect(forecast.dues.filter((d) => d.amount > 0)).toHaveLength(3);
    expect(
      forecast.dues.some((d) => d.account === "B" && d.amount === 40000),
    ).toBe(true);
  });
  it("does not invent salary or benefit from one payment, two payments, internal transfers or erratic refunds", () => {
    const one = tx("one", "2026-09-29", 180000, "C", "Nouveau salaire");
    const two = [
      tx("c1", "2026-08-05", 40000, "C", "CAF"),
      tx("c2", "2026-09-05", 40000, "C", "CAF"),
    ];
    expect(
      detectRecurrences(
        [one, ...two, ...history().map((t) => ({ ...t, internal: true }))],
        "2026-10-04",
      ),
    ).toEqual([]);
    expect(
      detectRecurrences(
        ["2026-07-02", "2026-08-14", "2026-09-25"].map((d, i) =>
          tx(String(i), d, 10000, "A", "Refund"),
        ),
        "2026-10-04",
      ),
    ).toEqual([]);
  });
  it("separates explicit senders even when the merchant is only a bank label", () => {
    const rows = history().map((t) => ({
      ...t,
      merchant: "Virement reçu",
      raw: { detail: t.label },
      label: "Virement reçu",
    }));
    const streams = detectRecurrences(rows, "2026-10-04");
    // Only Studio Lune has an explicit sender in these raw synthetic details;
    // it must not be merged with other generic same-account bank transfers.
    expect(streams.some((r) => r.amount === 180000 && r.account === "B")).toBe(
      true,
    );
  });
  it("keeps existing ignored sender references and matched real payments compatible", () => {
    const s = structuredClone(emptySnapshot);
    s.transactions = history();
    const source = s.transactions.find((t) => t.id === "B09")!;
    const oldName = source.merchant
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    s.preferences.dismissedRecurrences = [JSON.stringify(["B", oldName, 1])];
    expect(
      withEstimates(s, "2026-10-31", "2026-10-04").dues.some(
        (d) => d.amount === 180000,
      ),
    ).toBe(false);
    s.preferences.dismissedRecurrences = [];
    s.transactions.push(
      tx(
        "paid",
        "2026-10-28",
        180000,
        "B",
        "VIR RECU DE: Studio Lune MOTIF: PERIOD 10 REF: 8",
      ),
    );
    expect(
      withEstimates(s, "2026-10-31", "2026-10-04").dues.some(
        (d) => d.amount === 180000,
      ),
    ).toBe(false);
  });
  it("retains both salaries, aid, major expenses, transfers and extrema in the selected scope", () => {
    const s = structuredClone(emptySnapshot);
    s.accounts = [
      { id: "A", checkpoint: { date: "2026-10-31", amount: 200000 } },
      { id: "B", checkpoint: { date: "2026-10-31", amount: 100000 } },
    ];
    s.transactions = [
      tx("payA", "2026-10-02", 200000, "A", "Atelier Alpha"),
      tx("aid", "2026-10-05", 40000, "B", "Caisse allocations"),
      tx("rent", "2026-10-08", -90000, "A", "Logement"),
      tx("shop", "2026-10-12", -50000, "B", "Équipement"),
      tx("payB", "2026-10-28", 180000, "B", "Studio Lune"),
      tx("out", "2026-10-20", -20000, "A", "Transfert", true),
      tx("in", "2026-10-20", 20000, "B", "Transfert", true),
    ];
    const household = selectDashboard(
      s,
      "2026-10",
      "",
      "2026-10-31",
      "2026-10",
      { from: "2026-10-01", to: "2026-10-31" },
    );
    expect(
      household.points
        .flatMap((p) => p.movements)
        .map((m) => m.id)
        .sort(),
    ).toEqual(s.transactions.map((t) => t.id).sort());
    const notable = notableDays(household.points);
    for (const day of ["02", "05", "08", "12", "28"])
      expect(notable.some((n) => n.point.date === "2026-10-" + day)).toBe(true);
    expect(notable.some((n) => n.extrema === "Pic")).toBe(true);
    expect(notable.some((n) => n.extrema === "Creux")).toBe(true);
    expect(notable.find((n) => n.point.date === "2026-10-20")!.change).toBe(0);
    const scoped = selectDashboard(s, "2026-10", "B", "2026-10-31");
    expect(
      scoped.points.flatMap((p) => p.movements).every((m) => m.account === "B"),
    ).toBe(true);
    const view = render(
      <BalanceChart points={household.points} safety={0} showTable={false} />,
    );
    const rail = screen.getByRole("navigation", {
      name: "Repères de l’évolution du solde",
    });
    expect(screen.queryByRole("region", { name: /Mouvements du/ })).toBeNull();
    fireEvent.click(
      within(rail).getByRole("button", { name: /Caisse allocations/ }),
    );
    expect(
      screen.getByRole("region", { name: /Mouvements du 5 oct/ }).textContent,
    ).toContain("400");
    fireEvent.click(
      within(rail).getByRole("button", { name: /Caisse allocations/ }),
    );
    expect(
      screen.queryByRole("region", { name: /Mouvements du 5 oct/ }),
    ).toBeNull();
    view.rerender(
      <BalanceChart points={scoped.points} safety={0} showTable={false} />,
    );
    expect(screen.queryByText("Atelier Alpha")).toBeNull();
  });
  it("explains bank-anchor jumps and forecast provisions without fabricating transactions", () => {
    const s = structuredClone(emptySnapshot);
    s.accounts = [
      {
        id: "A",
        checkpoint: { date: "2026-10-04", amount: 100000 },
        checkpoints: [{ date: "2026-10-01", amount: 80000 }],
      },
    ];
    s.transactions = [tx("purchase", "2026-10-03", -10000, "A", "Équipement")];
    s.budgets = [
      { id: "b", month: "2026-10", category: "Courses", amount: 27000 },
    ];
    s.dues = [
      {
        id: "same-day",
        date: "2026-10-04",
        amount: -5000,
        account: "A",
        category: "Logement",
        label: "À rapprocher",
      },
    ];
    const dashboard = selectDashboard(s, "2026-10", "", "2026-10-04");
    expect(
      dashboard.points.find((p) => p.date === "2026-10-04")!.movements,
    ).toEqual([
      expect.objectContaining({
        kind: "adjustment",
        amount: 30000,
        account: "A",
      }),
    ]);
    const tomorrow = dashboard.points.find((p) => p.date === "2026-10-05")!;
    expect(tomorrow.movements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "provision",
          amount: -1000,
          estimated: true,
        }),
        expect.objectContaining({
          kind: "provision",
          amount: -5000,
          estimated: true,
        }),
      ]),
    );
    for (let i = 1; i < dashboard.points.length; i++) {
      const point = dashboard.points[i],
        previous = dashboard.points[i - 1];
      expect(point.movements.reduce((n, m) => n + m.amount, 0)).toBe(
        point.value - previous.value,
      );
    }
    expect(s.transactions).toHaveLength(1);
    expect(s.dues).toHaveLength(1);
  });
});
