import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { InsightWidget } from "./InsightWidget";
import { DataViz } from "./DataViz";
import { emptySnapshot, type WidgetId, type WidgetSize } from "./types";
import { selectDashboard } from "./domain";
import { distinctSeriesColors } from "./visual";
const snapshot = structuredClone(emptySnapshot);
snapshot.accounts = [
  { id: "A", checkpoint: { date: "2026-10-04", amount: 100000 } },
  { id: "B", checkpoint: { date: "2026-10-04", amount: 200000 } },
];
snapshot.preferences.goal = {
  name: "Projet1",
  saved: 10000,
  target: 100000,
  monthly: 2000,
};
snapshot.preferences.extraGoals = Array.from({ length: 11 }, (_, i) => ({
  name: "Projet" + (i + 2),
  saved: 10000,
  target: 100000,
  monthly: 2000,
}));
const d = selectDashboard(snapshot, "2026-10", "", "2026-10-04");
function card(id: WidgetId, size: WidgetSize) {
  return (
    <InsightWidget
      id={id}
      size={size}
      snapshot={snapshot}
      d={d}
      month="2026-10"
      from="2026-10"
      account=""
      configure={vi.fn()}
      transactions={vi.fn()}
      goals={vi.fn()}
      plan={vi.fn()}
    />
  );
}
describe("Compositions lisibles, pas listes identiques dans des boîtes différentes", () => {
  it("trois comptes conservent trois couleurs distinctes après réordonnancement", () => {
    const names = ["Courant", "Commun", "Épargne"];
    const colors = distinctSeriesColors(names);
    expect(new Set(Object.values(colors)).size).toBe(3);
    expect(distinctSeriesColors([...names].reverse())).toEqual(colors);
  });
  it("mini solde reste un montant daté sans commandes ni répartition", () => {
    const v = render(card("balance", "tiny"));
    expect(v.container.querySelector(".data-viz")).toBeNull();
    expect(v.container.textContent).toContain("Solde au");
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    v.rerender(card("balance", "medium"));
    expect(v.container.querySelectorAll(".viz-item")).toHaveLength(2);
    v.rerender(card("balance", "large"));
    expect(v.container.textContent).toContain("Référence au");
  });
  it("mini simulation renvoie vers le vrai simulateur au lieu de comprimer six champs", () => {
    render(card("purchase", "tiny"));
    expect(
      screen
        .getByRole("link", { name: "Tester un achat" })
        .getAttribute("href"),
    ).toBe("#week");
    expect(screen.queryAllByRole("spinbutton")).toHaveLength(0);
  });
  it("mini rythme et approvisionnement ne reproduisent pas les tableaux de la vue moyenne", () => {
    const v = render(card("pace", "tiny"));
    expect(v.container.querySelector("dl")).toBeNull();
    expect(v.container.textContent).toContain("jours écoulés");
    expect(v.container.textContent).toContain("couverture à vérifier");
    v.rerender(card("funding", "tiny"));
    expect(v.container.querySelector("dl")).toBeNull();
    expect(v.container.textContent).toContain("prévision partielle");
    v.rerender(card("funding", "medium"));
    expect(v.container.querySelectorAll("dt")).toHaveLength(2);
    expect(v.container.textContent).toContain("Aucun virement exécuté");
  });
  it("une vue unique ne produit pas un faux sélecteur et small conserve la donnée sans contrôles de grande carte", () => {
    const v = render(
      <DataViz
        widget="configuration"
        items={[{ name: "Net", value: -500 }]}
        limit={3}
      />,
    );
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    v.rerender(
      <DataViz
        size="small"
        widget="balance"
        initial="rings"
        items={[{ name: "A", value: 10000 }]}
        limit={3}
      />,
    );
    expect(screen.queryAllByRole("button")).toHaveLength(4);
    expect(v.container.querySelector("svg.concentric-chart")).toBeTruthy();
    expect(v.container.textContent).toContain("100");
  });
});
