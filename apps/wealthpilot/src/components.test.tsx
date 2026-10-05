import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Dashboard } from "./Dashboard";
import { BalanceChart } from "./Chart";
import { emptySnapshot } from "./types";
import { db } from "./store";
describe("Interactions et stabilité", () => {
  // Rendering dimensions / motion are verified in the real-browser matrices:
  // scripts/layout-usability-baseline.mjs and scripts/chart-explanation-qa.mjs.
  it("un dashboard vide ne fabrique pas de montant et conduit à l’import", () => {
    const navigate = vi.fn();
    render(
      <Dashboard
        snapshot={structuredClone(emptySnapshot)}
        month="2026-10"
        account=""
        importPage={navigate}
        notify={vi.fn()}
      />,
    );
    expect(screen.getByText("Votre première vue commence ici.")).toBeTruthy();
    expect(screen.queryByText("1 250 €")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Importer mon CSV" }));
    expect(navigate).toHaveBeenCalledOnce();
  });
  it("actualise la courbe puis affiche ses valeurs tabulaires sans remplacer son nœud SVG", () => {
    const points = [
      { date: "2026-10-01", value: 10000, future: false },
      { date: "2026-10-02", value: 12000, future: false },
    ];
    const { rerender } = render(
      <BalanceChart points={points} safety={1000} showTable={false} />,
    );
    const node = screen.getByRole("img");
    rerender(
      <BalanceChart
        points={points.map((p) => ({ ...p, value: p.value + 100 }))}
        safety={1000}
        showTable={false}
      />,
    );
    expect(screen.getByRole("img")).toBe(node);
    rerender(
      <BalanceChart
        points={points.map((p) => ({ ...p, value: p.value + 100 }))}
        safety={1000}
        showTable
      />,
    );
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByRole("cell", { name: /101\s€/ })).toBeTruthy();
    expect(screen.getByRole("img")).toBe(node);
  });
  it("la configuration est annulable sans écrire de préférences", async () => {
    const spy = vi.spyOn(db.preferences, "put");
    render(
      <Dashboard
        snapshot={structuredClone(emptySnapshot)}
        month="2026-10"
        account=""
        importPage={vi.fn()}
        notify={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Organiser mon dashboard" }),
    );
    expect(
      screen.getByRole("group", { name: "Organiser le dashboard" }),
    ).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Annuler$/ }));
    await waitFor(() =>
      expect(
        screen.queryByRole("group", { name: "Organiser le dashboard" }),
      ).toBeNull(),
    );
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Organiser mon dashboard" }),
      ),
    );
  });
  it("changement de période ne détruit pas les contrôles de graphique", () => {
    const s = structuredClone(emptySnapshot);
    const props = {
      snapshot: s,
      account: "",
      importPage: vi.fn(),
      notify: vi.fn(),
    };
    const { rerender } = render(<Dashboard {...props} month="2026-09" />);
    const select = screen.getByRole("combobox", {
      name: "Mesure du graphique",
    });
    fireEvent.keyDown(select, { key: "Enter" });
    fireEvent.click(screen.getByRole("option", { name: "Flux nets cumulés" }));
    rerender(<Dashboard {...props} month="2026-10" />);
    expect(screen.getByRole("combobox", { name: "Mesure du graphique" })).toBe(
      select,
    );
    expect(select.textContent).toContain("Flux nets cumulés");
  });
});
