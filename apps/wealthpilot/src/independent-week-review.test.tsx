import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { WeekPage, PurchaseTool } from "./WeekPage";
import { db } from "./store";
import { emptySnapshot } from "./types";
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-04T12:00:00Z"));
  await db.preferences.clear();
  await db.accounts.clear();
});
afterEach(() => vi.useRealTimers());
describe("Revue indépendante W1/S1 — interactions croisées", () => {
  it("recalcule un achat au changement de jour puis retire la conclusion quand sa date est passée", () => {
    vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
    const s = structuredClone(emptySnapshot);
    s.accounts = [
      { id: "A", checkpoint: { date: "2026-10-05", amount: 100000 } },
    ];
    s.transactions = [
      {
        id: "next-day",
        fingerprint: "next-day",
        batchId: "synthetic",
        account: "A",
        date: "2026-10-06",
        amount: -90000,
        category: "Courses",
        merchant: "Synthétique",
        label: "Synthétique",
        internal: false,
        raw: {},
      },
    ];
    render(
      <PurchaseTool
        snapshot={s}
        account="A"
        initialCategory="Courses"
        initialDate="2026-10-06"
      />,
    );
    fireEvent.change(screen.getByLabelText("Montant (€)"), {
      target: { value: "10" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmer et simuler" }),
    );
    const cash = () =>
      screen.getByText("Cash du payeur aujourd’hui").nextElementSibling
        ?.textContent;
    expect(cash()).toMatch(/1\s?000/);
    act(() => {
      vi.setSystemTime(new Date("2026-10-06T12:00:00Z"));
      window.dispatchEvent(new Event("focus"));
    });
    expect(cash()).toMatch(/^100\s?€/);
    act(() => {
      vi.setSystemTime(new Date("2026-10-07T12:00:00Z"));
      window.dispatchEvent(new Event("focus"));
    });
    expect(screen.queryByText("Cash du payeur aujourd’hui")).toBeNull();
    expect(
      (screen.getByLabelText("Montant (€)") as HTMLInputElement).value,
    ).toBe("10");
  });
  it("refuse d’écraser un plan modifié ailleurs pendant l’édition", async () => {
    const s = structuredClone(emptySnapshot);
    s.accounts = [
      { id: "A", checkpoint: { date: "2026-10-04", amount: 100000 } },
    ];
    s.preferences.weeklyPlans = [
      {
        start: "2026-09-28",
        account: "A",
        limits: { Courses: 10000 },
        reserve: 0,
        reduction: 0,
      },
    ];
    await db.preferences.put(s.preferences);
    await db.accounts.put(s.accounts[0]);
    render(<WeekPage snapshot={s} account="A" notify={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Cette semaine" }));
    fireEvent.click(screen.getByRole("button", { name: "Ajuster ce plan" }));
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Objectif Courses (€)" }),
      { target: { value: "150" } },
    );
    await db.preferences.put({
      ...s.preferences,
      weeklyPlans: [
        { ...s.preferences.weeklyPlans[0], limits: { Courses: 90000 } },
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await screen.findByText(
      /modifié.*ailleurs|changé.*ailleurs|modifié.*édition|changé dans un autre onglet/i,
    );
    expect(
      (await db.preferences.get("main"))?.weeklyPlans?.[0].limits.Courses,
    ).toBe(90000);
  });
  it("peut simuler une catégorie d’enveloppe même sans opération historique", async () => {
    const s = structuredClone(emptySnapshot);
    s.accounts = [{ id: "A" }];
    s.budgets = [
      {
        id: "b",
        category: "Courses",
        amount: 10000,
        month: "2026-10",
        account: "A",
      },
    ];
    render(<PurchaseTool snapshot={s} account="A" />);
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Catégorie" }), {
      key: "Enter",
    });
    expect(await screen.findByRole("option", { name: "Courses" })).toBeTruthy();
  });
});
