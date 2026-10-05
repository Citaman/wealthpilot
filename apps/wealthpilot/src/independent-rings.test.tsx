import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DataViz } from "./DataViz";
import { Dashboard } from "./Dashboard";
import { emptySnapshot } from "./types";

describe("Contre-vérification numérique indépendante des anneaux", () => {
  it("garde zéro invisible, sature le dessin au dépassement et affiche le vrai pourcentage", () => {
    render(
      <DataViz
        widget="goals"
        initial="rings"
        limit={5}
        items={[
          { name: "Vide", value: 0, target: 10000 },
          { name: "Dépassé", value: 15000, target: 10000 },
          { name: "Sans cible", value: 5000, target: 0 },
        ]}
      />,
    );
    const arcs = [
      ...screen.getByRole("img").querySelectorAll("circle[pathLength]"),
    ];
    expect(arcs.map((a) => a.getAttribute("stroke-dasharray"))).toEqual([
      "0 100",
      "100 100",
      "0 100",
    ]);
    expect(arcs.map((a) => a.getAttribute("stroke-opacity"))).toEqual([
      "0",
      "1",
      "0",
    ]);
    expect(screen.getByText("150 % de la cible · cible dépassée")).toBeTruthy();
    expect(screen.getByText("Cible à définir")).toBeTruthy();
  });
  it("refuse une part négative et conserve ses euros signés, sans anneau trompeur", () => {
    render(
      <DataViz
        widget="balance"
        initial="rings"
        limit={5}
        items={[
          { name: "A", value: -2000 },
          { name: "B", value: 10000 },
        ]}
      />,
    );
    expect(screen.queryByRole("img")).toBeNull();
    expect(
      screen
        .getByRole("button", { name: "Anneaux — balance" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(screen.getByText(/-20\s*€/)).toBeTruthy();
    expect(screen.getByText("Montants signés")).toBeTruthy();
  });
  it("calcule chaque part sur le total complet, même si une carte masque des lignes", () => {
    render(
      <DataViz
        widget="categories"
        initial="rings"
        limit={2}
        items={[
          { name: "A", value: 1000 },
          { name: "B", value: 2000 },
          { name: "C", value: 7000 },
        ]}
      />,
    );
    expect(
      [...screen.getByRole("img").querySelectorAll("circle[pathLength]")].map(
        (a) => a.getAttribute("stroke-dasharray"),
      ),
    ).toEqual(["10 100", "20 100"]);
    expect(screen.getByText(/2 sur 3/)).toBeTruthy();
  });
  it("anneaux budget : zéro sans point, dépassement à un tour, sans plafond explicite", () => {
    const s = structuredClone(emptySnapshot);
    s.preferences.widgets = ["budgets"];
    s.preferences.budgetView = "rings";
    s.preferences.budgetOrder = ["Vide", "Dépassé", "Sans plafond"];
    s.budgets = ["Vide", "Dépassé", "Sans plafond"].map((category, i) => ({
      id: `b${i}`,
      month: "2026-10",
      category,
      amount: i === 2 ? 0 : 10000,
    }));
    s.transactions = ["Dépassé", "Sans plafond"].map((category, i) => ({
      id: `t${i}`,
      batchId: "test",
      fingerprint: `f${i}`,
      date: "2026-10-02",
      label: category,
      merchant: category,
      category,
      account: "A",
      amount: i === 0 ? -15000 : -5000,
      internal: false,
      raw: {},
    }));
    render(
      <Dashboard
        snapshot={s}
        month="2026-10"
        account=""
        importPage={vi.fn()}
        notify={vi.fn()}
      />,
    );
    const arcs = [
      ...screen
        .getByRole("img", { name: /Dépenses réalisées/ })
        .querySelectorAll("circle[stroke-dasharray]"),
    ];
    expect(arcs.map((a) => a.getAttribute("stroke-opacity"))).toEqual([
      "0",
      "1",
      "1",
    ]);
    expect(Number(arcs[0].getAttribute("stroke-dashoffset"))).toBeCloseTo(
      2 * Math.PI * Number(arcs[0].getAttribute("r")),
    );
    expect(
      arcs.slice(1).map((a) => Number(a.getAttribute("stroke-dashoffset"))),
    ).toEqual([0, 0]);
    expect(screen.getByText("150 %")).toBeTruthy();
    expect(
      screen.getByText("Sans plafond", { selector: ".budget-label > span" }),
    ).toBeTruthy();
  });
});
