import { beforeEach, describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RecurrencesPage } from "./RecurrencesPage";
import { CalendarPage } from "./CalendarPage";
import { db } from "./store";
import { emptySnapshot, type Snapshot } from "./types";
import { addDays, dateLabel, today } from "./domain";
import { withEstimates } from "./intelligence";
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});
const base = (): Snapshot => ({
  ...structuredClone(emptySnapshot),
  accounts: [{ id: "A", checkpoint: { date: today(), amount: 100000 } }],
});
describe("Recurring and calendar page actions", () => {
  it("adjusts a predicted occurrence atomically without duplicating it or its next payment", async () => {
    const snapshot = base(),
      date = addDays(today(), 2);
    snapshot.preferences.recurrenceRules = [
      {
        id: "rule",
        name: "Fixture recurring",
        account: "A",
        amount: -1000,
        category: "Bills",
        frequency: "weekly",
        next: date,
      },
    ];
    await db.accounts.bulkPut(snapshot.accounts);
    await db.preferences.put(snapshot.preferences);
    render(
      <CalendarPage
        snapshot={snapshot}
        month={date.slice(0, 7)}
        notify={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: `${dateLabel(date)}, 0 opérations importées à venir, 1 échéances`,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Ajuster cette occurrence" }),
    );
    fireEvent.change(screen.getByLabelText("Date prévue"), {
      target: { value: addDays(date, 6) },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer l’échéance" }),
    );
    await waitFor(async () => expect(await db.dues.count()).toBe(1));
    const stored = await db.snapshot();
    expect(stored.preferences.ignoredOccurrences).toHaveLength(1);
    expect(stored.dues[0].originOccurrenceId).toBe(
      stored.preferences.ignoredOccurrences![0],
    );
    expect(
      withEstimates(stored, addDays(date, 7), today())
        .dues.map((d) => d.date)
        .sort(),
    ).toEqual([addDays(date, 6), addDays(date, 7)]);
  });
  it("saves a manually confirmed rule with working account/cadence controls", async () => {
    const snapshot = base();
    await db.accounts.bulkPut(snapshot.accounts);
    await db.preferences.put(snapshot.preferences);
    render(<RecurrencesPage snapshot={snapshot} notify={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Nouvelle règle" }));
    fireEvent.change(screen.getByLabelText("Nom de la récurrence"), {
      target: { value: "Water" },
    });
    fireEvent.change(screen.getByLabelText("Montant signé (€)"), {
      target: { value: "-12.50" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer la règle" }),
    );
    await waitFor(async () =>
      expect(
        (await db.preferences.get("main"))?.recurrenceRules?.[0],
      ).toMatchObject({
        name: "Water",
        account: "A",
        amount: -1250,
        frequency: "monthly",
      }),
    );
  });
  it("switches calendar views and persists a new real due without a bank operation", async () => {
    const snapshot = base();
    await db.accounts.bulkPut(snapshot.accounts);
    await db.preferences.put(snapshot.preferences);
    render(<CalendarPage snapshot={snapshot} notify={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "7 jours" }));
    expect(document.querySelectorAll(".calendar-day")).toHaveLength(7);
    fireEvent.click(screen.getByRole("button", { name: "Nouvelle échéance" }));
    fireEvent.change(screen.getByLabelText("Libellé de l’échéance"), {
      target: { value: "Future bill" },
    });
    fireEvent.change(screen.getByLabelText("Montant signé (€)"), {
      target: { value: "-25.40" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer l’échéance" }),
    );
    await waitFor(async () =>
      expect((await db.dues.toArray())[0]).toMatchObject({
        label: "Future bill",
        account: "A",
        amount: -2540,
      }),
    );
    expect(await db.transactions.count()).toBe(0);
  });
});
