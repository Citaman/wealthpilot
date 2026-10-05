import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { emptySnapshot } from "./types";
import { selectDashboard } from "./domain";
import { Dashboard } from "./Dashboard";
import { DataViz } from "./DataViz";
import { GoalsEditor } from "./Planning";
import { db, validateBackup } from "./store";
const sample = () => {
  const s = structuredClone(emptySnapshot);
  s.accounts = [
    { id: "a", checkpoint: { date: "2026-10-03", amount: 100000 } },
  ];
  s.preferences.safety = 30000;
  s.preferences.goal = { name: "Maison", target: 1000000, saved: 80000 };
  return s;
};
beforeEach(async () => {
  await db.preferences.clear();
});
describe("Raffinement produit", () => {
  it("distingue déficit du plan et découvert bancaire sans effacer le calcul", () => {
    const s = sample();
    s.dues = [
      {
        id: "d",
        label: "Internet",
        amount: -4000,
        date: "2026-10-10",
        account: "a",
        estimated: true,
      },
    ];
    const d = selectDashboard(s, "2026-10", "", "2026-10-03");
    expect(d.balance).toBe(100000);
    expect(d.available).toBe(-14000);
    expect(d.estimatedObligations).toBe(4000);
    expect(d.confirmedObligations).toBe(0);
    s.preferences.widgets = ["available"];
    render(
      <Dashboard
        snapshot={s}
        month="2026-10"
        account=""
        importPage={vi.fn()}
        notify={vi.fn()}
      />,
    );
    expect(screen.getByText("aucune marge libre selon le plan")).toBeTruthy();
    expect(screen.getByText(/140.*à couvrir/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Voir le calcul" }));
    expect(screen.getByText("Manque pour couvrir le plan")).toBeTruthy();
  });
  it("suit l’ordre choisi des enveloppes et conserve les catégories nouvelles", () => {
    const s = sample();
    s.budgets = [
      { id: "a", category: "Courses", amount: 50000, month: "2026-10" },
      { id: "b", category: "Loisirs", amount: 10000, month: "2026-10" },
      { id: "c", category: "Transport", amount: 10000, month: "2026-10" },
    ];
    s.preferences.budgetOrder = ["Loisirs", "Courses"];
    expect(
      selectDashboard(s, "2026-10", "", "2026-10-03").budgets.map(
        (b) => b.category,
      ),
    ).toEqual(["Loisirs", "Courses", "Transport"]);
  });
  it("sauvegarde une variante réelle sans modifier les réglages financiers", async () => {
    const p = sample().preferences;
    await db.preferences.put(p);
    render(
      <DataViz
        widget="goals"
        limit={5}
        items={[
          { name: "Maison", value: 50000, target: 100000 },
          { name: "Téléphone", value: 0, target: 10000 },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Anneaux — goals" }));
    const chart = screen.getByRole("img", {
      name: "Anneaux concentriques : avancement de chaque cible",
    });
    const arcs = [...chart.querySelectorAll("circle[stroke-dasharray]")];
    expect(arcs).toHaveLength(2);
    expect(arcs.map((a) => a.getAttribute("cx"))).toEqual(["120", "120"]);
    expect(arcs.map((a) => a.getAttribute("r"))).toEqual(["106", "89"]);
    expect(arcs.map((a) => a.getAttribute("stroke-dasharray"))).toEqual([
      "50 100",
      "0 100",
    ]);
    await waitFor(async () =>
      expect((await db.preferences.get("main"))?.widgetViews?.goals).toBe(
        "rings",
      ),
    );
    expect((await db.preferences.get("main"))?.safety).toBe(30000);
  });
  it("ne représente pas de montant négatif en part de cercle", () => {
    render(
      <DataViz
        widget="flows"
        limit={5}
        items={[{ name: "Net", value: -1000 }]}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Anneaux — flows" }),
    ).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });
  it("n’additionne pas les flux et leur net dans une fausse répartition", () => {
    render(
      <DataViz
        widget="flows"
        limit={5}
        items={[
          { name: "Entrées", value: 10000 },
          { name: "Sorties", value: 5000 },
          { name: "Net", value: 5000 },
        ]}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Anneaux — flows" }),
    ).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("Comparaison des montants")).toBeTruthy();
  });
  it("revient aux lignes lorsqu’une vue en anneaux rencontre un solde négatif", () => {
    const { container } = render(
      <DataViz
        widget="balance"
        initial="rings"
        limit={5}
        items={[{ name: "Compte", value: -1000 }]}
      />,
    );
    expect(
      screen
        .getByRole("button", { name: "Lignes — balance" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(container.querySelector(".viz-track-bar i")).toBeTruthy();
    expect(container.querySelector(".viz-arc")).toBeNull();
  });
  it("mémorise le nombre d’enveloppes et leur ordre sans effacer les réserves", async () => {
    const s = sample();
    s.preferences.widgets = ["budgets"];
    s.budgets = ["Courses", "Loisirs", "Transport", "Santé"].map(
      (category, i) => ({
        id: String(i),
        category,
        amount: 10000,
        month: "2026-10",
      }),
    );
    await db.preferences.put(s.preferences);
    const view = render(
      <Dashboard
        snapshot={s}
        month="2026-10"
        account=""
        importPage={vi.fn()}
        notify={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Tout" }));
    await waitFor(async () =>
      expect(
        (await db.preferences.get("main"))?.board?.views[0].instances[0].options
          ?.budgetLimit,
      ).toBe(0),
    );
    s.preferences = (await db.preferences.get("main"))!;
    view.rerender(
      <Dashboard
        snapshot={s}
        month="2026-10"
        account=""
        importPage={vi.fn()}
        notify={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Déplacer Loisirs" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Placer Loisirs à la place de Courses",
      }),
    );
    await waitFor(async () =>
      expect(
        (await db.preferences.get("main"))?.board?.views[0].instances[0].options
          ?.budgetOrder?.[0],
      ).toBe("Loisirs"),
    );
    expect((await db.preferences.get("main"))?.safety).toBe(30000);
    expect(
      (await db.preferences.get("main"))?.board?.views[0].instances[0].options
        ?.budgetLimit,
    ).toBe(0);
  });
  it("catalogue affiche le composant réel et non un dessin générique", () => {
    const s = sample();
    s.preferences.widgets = ["chart"];
    render(
      <Dashboard
        snapshot={s}
        month="2026-10"
        account=""
        importPage={vi.fn()}
        notify={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Organiser mon dashboard" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une carte" }));
    const catalog = screen.getByRole("region", { name: "Ajouter une carte" });
    expect(catalog.querySelectorAll(".catalog-card")).toHaveLength(16);
    expect(
      catalog.querySelectorAll(".catalog-preview .card").length,
    ).toBeGreaterThanOrEqual(16);
    fireEvent.click(
      within(catalog).getByRole("button", {
        name: "Toutes les cartes disponibles",
      }),
    );
    expect(catalog.querySelectorAll(".catalog-card")).toHaveLength(25);
    expect(
      catalog.querySelectorAll(".catalog-preview .card").length,
    ).toBeGreaterThanOrEqual(25);
    expect(
      within(catalog).queryByRole("button", { name: "Ajouter Mon objectif" }),
    ).toBeNull();
    expect(
      within(catalog).queryByRole("button", {
        name: "Ajouter Tous mes objectifs",
      }),
    ).toBeNull();
    expect(
      within(catalog).getByRole("button", {
        name: "Ajouter Disponible cette semaine",
      }),
    ).toBeTruthy();
    expect(catalog.querySelector(".catalog-glyph")).toBeNull();
    expect(
      within(catalog).getByRole("button", {
        name: "Ajouter Disponible à dépenser",
      }),
    ).toBeTruthy();
  });
  it("enregistre identité et couleur d’objectif puis valide la sauvegarde", async () => {
    const s = sample();
    await db.preferences.put(s.preferences);
    render(<GoalsEditor snapshot={s} notify={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Icône et couleur"));
    fireEvent.click(screen.getByRole("button", { name: "Icône Maison" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Couleur du projet 2" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer les objectifs" }),
    );
    await waitFor(async () =>
      expect((await db.preferences.get("main"))?.goal?.icon).toBe("house"),
    );
    s.preferences = (await db.preferences.get("main"))!;
    expect(s.preferences.goal?.color).toBe("#187080");
    expect(() =>
      validateBackup({ format: "wealthpilot-next", version: 1, data: s }),
    ).not.toThrow();
  });
});
