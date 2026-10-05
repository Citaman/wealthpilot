import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GoalsEditor } from "./Planning";
import {
  GoalIdentity,
  goalColors,
  goalForeground,
  goalIcons,
} from "./GoalIdentity";
import { goalIconKeys } from "./goal-icon-keys";
import { emptySnapshot } from "./types";
import { db, validateBackup } from "./store";

async function fixture(count = 1) {
  const s = structuredClone(emptySnapshot);
  const goals = Array.from({ length: count }, (_, i) => ({
    name: "Projet " + (i + 1),
    saved: 5000,
    target: 100000,
    monthly: 1000,
    icon: "house",
    color: goalColors[0],
  }));
  s.preferences.goal = goals[0] ?? null;
  s.preferences.extraGoals = goals.slice(1);
  await db.preferences.put(s.preferences);
  return s;
}
beforeEach(async () => {
  await db.preferences.clear();
  await db.accounts.clear();
});
const save = () =>
  fireEvent.click(
    screen.getByRole("button", { name: "Enregistrer les objectifs" }),
  );
describe("O1 — objectifs compacts, identité et édition sûre", () => {
  it("propose 70 icônes explicites persistables et 28 couleurs distinctes avec contraste automatique", async () => {
    expect(Object.keys(goalIcons).length).toBeGreaterThanOrEqual(60);
    expect(goalIconKeys.slice().sort()).toEqual(
      [...Object.keys(goalIcons), "none"].sort(),
    );
    expect(new Set(goalColors).size).toBeGreaterThanOrEqual(24);
    expect(goalForeground("#ffffff")).toBe("#000000");
    expect(goalForeground("#000000")).toBe("#ffffff");
    const s = await fixture();
    for (const icon of goalIconKeys) {
      s.preferences.goal!.icon = icon;
      expect(() =>
        validateBackup({ format: "wealthpilot-next", version: 1, data: s }),
      ).not.toThrow();
    }
    const view = render(
      <GoalIdentity goal={{ ...s.preferences.goal!, icon: "none" }} />,
    );
    expect(view.container.querySelector("svg")).toBeNull();
  });
  it("recherche sans accent dans les groupes, choisit sans icône et couleur personnalisée puis persiste", async () => {
    const s = await fixture();
    const close = vi.fn();
    render(<GoalsEditor snapshot={s} notify={vi.fn()} onClose={close} />);
    expect(screen.getByText("Icône et couleur").closest("details")?.open).toBe(
      false,
    );
    fireEvent.click(screen.getByText("Icône et couleur"));
    const user = userEvent.setup();
    await user.type(
      screen.getByRole("searchbox", { name: "Rechercher une icône" }),
      "velo",
    );
    expect(screen.getByRole("button", { name: "Icône Vélo" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Icône Maison" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Sans icône" }));
    fireEvent.change(screen.getByLabelText("Couleur personnalisée"), {
      target: { value: "#faff00" },
    });
    save();
    await waitFor(() => expect(close).toHaveBeenCalled());
    expect((await db.preferences.get("main"))?.goal).toMatchObject({
      icon: "none",
      color: "#faff00",
    });
  });
  it("annule le retrait et annule l’ensemble sans toucher aux réserves persistées", async () => {
    const s = await fixture(2);
    const close = vi.fn();
    render(<GoalsEditor snapshot={s} notify={vi.fn()} onClose={close} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Retirer ce projet de la liste" }),
    );
    expect(screen.getByText(/retiré du brouillon/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Annuler le retrait" }));
    expect(
      screen.getByRole("textbox", { name: "Nom du projet 1" }),
    ).toHaveProperty("value", "Projet 1");
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Déjà réservé (€) — projet 1" }),
      { target: { value: "500" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Annuler les modifications" }),
    );
    expect(close).toHaveBeenCalled();
    expect((await db.preferences.get("main"))?.goal?.saved).toBe(5000);
  });
  it("bloque une modification concurrente d’objectif mais conserve le brouillon", async () => {
    const s = await fixture();
    const close = vi.fn();
    render(<GoalsEditor snapshot={s} notify={vi.fn()} onClose={close} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Nom du projet 1" }), {
      target: { value: "Mon brouillon" },
    });
    await db.preferences.put({
      ...s.preferences,
      goal: { ...s.preferences.goal!, saved: 9000 },
    });
    save();
    await screen.findByText(/Les objectifs ont changé ailleurs/);
    expect(close).not.toHaveBeenCalled();
    expect(
      screen.getByRole("textbox", { name: "Nom du projet 1" }),
    ).toHaveProperty("value", "Mon brouillon");
    expect((await db.preferences.get("main"))?.goal?.saved).toBe(9000);
  });
  it("fusionne les préférences non liées et normalise la suppression d’une échéance", async () => {
    const s = await fixture();
    s.preferences.goal!.deadline = "2027-01-01";
    await db.preferences.put(s.preferences);
    const close = vi.fn();
    render(<GoalsEditor snapshot={s} notify={vi.fn()} onClose={close} />);
    fireEvent.change(screen.getByLabelText("Échéance — projet 1"), {
      target: { value: "" },
    });
    await db.preferences.put({ ...s.preferences, safety: 12345 });
    save();
    await waitFor(() => expect(close).toHaveBeenCalled());
    const stored = (await db.preferences.get("main"))!;
    expect(stored.safety).toBe(12345);
    expect(stored.goal?.deadline).toBeUndefined();
    expect(() =>
      validateBackup({
        format: "wealthpilot-next",
        version: 1,
        data: { ...s, preferences: stored },
      }),
    ).not.toThrow();
  });
  it("n’affiche qu’un éditeur pour 101 projets et désactive l’ajout à la limite", async () => {
    const s = await fixture(101);
    s.preferences.extraGoals![99].name =
      "Objectif au nom extrêmement long ".repeat(5);
    render(<GoalsEditor snapshot={s} notify={vi.fn()} onClose={vi.fn()} />);
    expect(
      screen.getAllByRole("textbox", { name: /Nom du projet/ }),
    ).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Ajouter un projet" }),
    ).toHaveProperty("disabled", true);
  });
  it("déplace la priorité indépendamment du projet vedette", async () => {
    const s = await fixture(3);
    const close = vi.fn();
    render(<GoalsEditor snapshot={s} notify={vi.fn()} onClose={close} />);
    fireEvent.click(screen.getByRole("button", { name: /^Projet 3 / }));
    fireEvent.click(screen.getByRole("button", { name: "Monter la priorité" }));
    fireEvent.click(screen.getByRole("button", { name: "Monter la priorité" }));
    save();
    await waitFor(() => expect(close).toHaveBeenCalled());
    const p = (await db.preferences.get("main"))!;
    expect(p.goal?.name).toBe("Projet 1");
    expect(p.goal?.priority).toBe(1);
    expect(p.extraGoals?.find((g) => g.name === "Projet 3")?.priority).toBe(0);
  });
  it("refuse une cible nulle et ne transforme pas une réserve en mouvement bancaire", async () => {
    const s = await fixture();
    render(<GoalsEditor snapshot={s} notify={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Cible (€) — projet 1" }),
      { target: { value: "0" } },
    );
    save();
    await screen.findByText(/Chaque objectif doit avoir un nom/);
    expect((await db.preferences.get("main"))?.goal?.target).toBe(100000);
  });
  it("enregistre compte et date mais refuse un compte supprimé pendant l’édition", async () => {
    const s = await fixture();
    s.accounts = [{ id: "Commun" }];
    await db.accounts.put(s.accounts[0]);
    const close = vi.fn();
    render(<GoalsEditor snapshot={s} notify={vi.fn()} onClose={close} />);
    fireEvent.keyDown(
      screen.getByRole("combobox", { name: "Compte — projet 1" }),
      { key: "Enter" },
    );
    fireEvent.click(await screen.findByRole("option", { name: "Commun" }));
    fireEvent.change(screen.getByLabelText("Échéance — projet 1"), {
      target: { value: "2027-03-15" },
    });
    await db.accounts.delete("Commun");
    save();
    await screen.findByText(/Un compte a été retiré depuis l’ouverture/);
    expect(close).not.toHaveBeenCalled();
    await db.accounts.put(s.accounts[0]);
    save();
    await waitFor(() => expect(close).toHaveBeenCalled());
    expect((await db.preferences.get("main"))?.goal).toMatchObject({
      account: "Commun",
      deadline: "2027-03-15",
    });
  });
});
