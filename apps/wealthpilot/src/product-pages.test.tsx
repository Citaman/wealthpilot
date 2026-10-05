import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HouseholdPage } from "./HouseholdPage";
import { ForecastPage, BudgetsPage } from "./ProductPages";
import { db } from "./store";
import { emptySnapshot } from "./types";
beforeEach(async () => {
  await db.delete();
  await db.open();
});
describe("specialist pages preserve real financial facts", () => {
  it("cannot reallocate money already spent in the source envelope", async () => {
    const s = structuredClone(emptySnapshot);
    s.accounts = [
      { id: "A", checkpoint: { date: "2026-10-04", amount: 100000 } },
    ];
    s.budgets = [
      {
        id: "food",
        month: "2026-10",
        account: "A",
        category: "Courses",
        amount: 10000,
      },
      {
        id: "fuel",
        month: "2026-10",
        account: "A",
        category: "Carburant",
        amount: 5000,
      },
    ];
    s.transactions = [
      {
        id: "t",
        batchId: "t",
        date: "2026-10-01",
        amount: -9000,
        account: "A",
        label: "Courses",
        merchant: "Courses",
        category: "Courses",
        internal: false,
        raw: {},
        fingerprint: "t",
      },
    ];
    await db.budgets.bulkPut(s.budgets);
    await db.transactions.bulkPut(s.transactions);
    render(
      <BudgetsPage
        snapshot={s}
        account="A"
        month="2026-10"
        from="2026-10"
        notify={vi.fn()}
      />,
    );
    fireEvent.keyDown(
      screen.getByRole("combobox", { name: "Depuis l’enveloppe" }),
      { key: "Enter" },
    );
    fireEvent.click(await screen.findByRole("option", { name: "Courses" }));
    fireEvent.keyDown(
      screen.getByRole("combobox", { name: "Vers l’enveloppe" }),
      { key: "Enter" },
    );
    fireEvent.click(await screen.findByRole("option", { name: "Carburant" }));
    fireEvent.change(screen.getByLabelText("Somme à déplacer (€)"), {
      target: { value: "20" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmer la réallocation" }),
    );
    await screen.findByText(/somme ne peut pas dépasser/);
    expect((await db.budgets.get("food"))?.amount).toBe(10000);
  });
  it("saves a chosen household rule twice without false concurrency conflict", async () => {
    const s = structuredClone(emptySnapshot);
    s.accounts = [{ id: "A" }, { id: "B" }];
    await db.preferences.put(s.preferences);
    render(<HouseholdPage snapshot={s} notify={vi.fn()} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Proposer un partage égalitaire" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer cette règle" }),
    );
    await waitFor(async () =>
      expect(
        (await db.preferences.get("main"))?.householdPlan?.members.map(
          (m) => m.share,
        ),
      ).toEqual([50, 50]),
    );
    fireEvent.change(screen.getByLabelText("Part de A (%)"), {
      target: { value: "60" },
    });
    fireEvent.change(screen.getByLabelText("Part de B (%)"), {
      target: { value: "40" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer cette règle" }),
    );
    await waitFor(async () =>
      expect(
        (await db.preferences.get("main"))?.householdPlan?.members.map(
          (m) => m.share,
        ),
      ).toEqual([60, 40]),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("refuses implicit or incomplete household division", async () => {
    const s = structuredClone(emptySnapshot);
    s.accounts = [{ id: "A" }];
    await db.preferences.put(s.preferences);
    render(<HouseholdPage snapshot={s} notify={vi.fn()} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer cette règle" }),
    );
    await screen.findByText(/parts doivent totaliser/);
    expect((await db.preferences.get("main"))?.householdPlan).toBeUndefined();
  });
  it("scenario saving never moves an imported transaction or original due", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-04T12:00:00Z"));
    try {
      const s = structuredClone(emptySnapshot);
      s.accounts = [
        { id: "A", checkpoint: { date: "2026-10-04", amount: 100000 } },
      ];
      s.dues = [
        {
          id: "past",
          label: "Paie échue",
          date: "2026-10-02",
          account: "A",
          amount: 50000,
        },
      ];
      await db.preferences.put(s.preferences);
      await db.dues.bulkPut(s.dues);
      render(
        <ForecastPage
          snapshot={s}
          account="A"
          month="2026-10"
          from="2026-10"
          notify={vi.fn()}
        />,
      );
      fireEvent.change(
        screen.getByLabelText("Retard des revenus attendus (jours)"),
        { target: { value: "7" } },
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Enregistrer une copie" }),
      );
      await waitFor(async () =>
        expect(
          (await db.preferences.get("main"))?.scenarios?.[0].incomeDelay,
        ).toBe(7),
      );
      expect((await db.dues.get("past"))?.date).toBe("2026-10-02");
      // The late old paycheck is not resurrected at October 9 in the hypothetical graph.
      expect(screen.getAllByText(/1.000/).length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
