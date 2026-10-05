import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { WeekPage } from "./WeekPage";
import { emptySnapshot } from "./types";
import { db } from "./store";

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-04T12:00:00Z"));
  await db.preferences.clear();
});
afterEach(() => vi.useRealTimers());
const fixture = () => {
  const s = structuredClone(emptySnapshot);
  s.accounts = [
    { id: "Commun", checkpoint: { date: "2026-10-04", amount: 100000 } },
  ];
  s.preferences.weeklyPlans = [
    {
      start: "2026-10-05",
      account: "",
      limits: { Courses: 10000, Loisirs: 4000 },
      reserve: 0,
      reduction: 0,
    },
  ];
  return s;
};
describe("Ma semaine — lecture prioritaire et actions contextuelles", () => {
  it("ouvre la prochaine semaine en lecture, avec marge commune et sans formulaire financier", () => {
    render(<WeekPage snapshot={fixture()} account="" notify={vi.fn()} />);
    expect(
      screen
        .getByRole("button", { name: "Prochaine" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.queryByRole("spinbutton")).toBeNull();
    expect(screen.queryByRole("slider")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(
      within(
        screen.getByRole("region", { name: "Votre marge de la semaine" }),
      ).getByText(/140\s*€/),
    ).toBeTruthy();
    expect(
      screen.getByText(/Les montants ci-dessous se partagent/),
    ).toBeTruthy();
    expect(screen.getByText("Plan enregistré")).toBeTruthy();
  });
  it("ouvre le simulateur sur la catégorie choisie, date future correcte et rend le focus", async () => {
    render(<WeekPage snapshot={fixture()} account="" notify={vi.fn()} />);
    const trigger = screen.getByRole("button", {
      name: "Tester un achat en Courses",
    });
    trigger.focus();
    fireEvent.click(trigger);
    expect(
      screen.getByRole("combobox", { name: "Catégorie" }).textContent,
    ).toContain("Courses");
    expect(
      screen.getByRole("combobox", { name: "Compte payeur" }).textContent,
    ).toContain("Commun");
    expect(
      (screen.getByLabelText("Date prévue") as HTMLInputElement).value,
    ).toBe("2026-10-05");
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Fermer le simulateur" }),
    );
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });
  it("édition explicite et annulation sans écrire le plan", async () => {
    const s = fixture();
    await db.preferences.put(s.preferences);
    render(<WeekPage snapshot={s} account="" notify={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Ajuster ce plan" }));
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Objectif Courses (€)" }),
      { target: { value: "300" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.queryByRole("spinbutton")).toBeNull();
    expect(
      (await db.preferences.get("main"))?.weeklyPlans?.[0].limits.Courses,
    ).toBe(10000);
  });
  it("ne perd pas une modification quand on demande une autre semaine", () => {
    render(<WeekPage snapshot={fixture()} account="" notify={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Ajuster ce plan" }));
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Objectif Courses (€)" }),
      { target: { value: "321" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Cette semaine" }));
    expect(screen.getByText(/modifications non enregistrées/)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Continuer à modifier" }),
    );
    expect(
      (
        screen.getByRole("spinbutton", {
          name: "Objectif Courses (€)",
        }) as HTMLInputElement
      ).value,
    ).toBe("321");
  });
  it("ne transforme pas un solde inconnu en marge disponible", () => {
    const s = fixture();
    s.accounts[0].checkpoint = undefined;
    render(<WeekPage snapshot={s} account="" notify={vi.fn()} />);
    expect(screen.getByText("Solde à confirmer")).toBeTruthy();
    expect(screen.getAllByText("à définir")).toHaveLength(2);
  });
});
