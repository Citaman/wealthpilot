import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { DashboardBoard } from "./DashboardBoard";
import { BalanceChart, chartTicks } from "./Chart";
import { emptySnapshot, type Snapshot } from "./types";
import { db } from "./store";

beforeEach(async () => {
  await db.preferences.clear();
});

function renderBoard(snapshot: Snapshot, finish = vi.fn()) {
  return render(
    <DashboardBoard
      snapshot={snapshot}
      editing
      onFinish={finish}
      notify={vi.fn()}
    >
      {(id, size) => (
        <section className="card">
          {id}: {size}
        </section>
      )}
    </DashboardBoard>,
  );
}

describe("Manipulation directe du dashboard", () => {
  it("conserve détail et couleur, mais ramène une ligne vide à la première place compacte", async () => {
    const s = structuredClone(emptySnapshot);
    s.preferences.widgets = ["chart", "available"];
    await db.preferences.put({ ...s.preferences, safety: 45000 });
    const finish = vi.fn();
    renderBoard(s, finish);
    expect(
      screen.queryByRole("group", { name: "Taille de Disponible à dépenser" }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Personnaliser Disponible à dépenser",
      }),
    );
    expect(
      screen.getByRole("group", { name: "Taille de Disponible à dépenser" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("group", { name: "Taille de Évolution du solde" }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Petit — Disponible à dépenser" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Rose — Disponible à dépenser" }),
    );
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Ligne de la carte" }),
      { target: { value: "120" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Terminer" }));
    await waitFor(() => expect(finish).toHaveBeenCalledOnce());
    const saved = await db.preferences.get("main");
    expect(saved?.widgets).toEqual(["chart", "available"]);
    expect(
      saved?.board?.views[0].layouts.laptop.find(
        (p) => p.i === "legacy-available",
      )?.y,
    ).toBe(46);
    expect(saved?.sizes?.available).toBe("small");
    expect(saved?.tones?.available).toBe("pink");
    expect(saved?.safety).toBe(45000);
  });

  it("replace le focus après retrait et ajout, y compris sur un dashboard vidé", async () => {
    const s = structuredClone(emptySnapshot);
    s.preferences.widgets = ["chart", "available"];
    renderBoard(s);
    fireEvent.click(
      screen.getByRole("button", { name: "Retirer Disponible à dépenser" }),
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", {
          name: "Personnaliser Évolution du solde",
        }),
      ),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Retirer Évolution du solde" }),
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Ajouter une carte" }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une carte" }));
    const catalog = screen.getByRole("region", { name: "Ajouter une carte" });
    fireEvent.click(
      within(catalog).getByRole("button", { name: /Évolution du solde/ }),
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", {
          name: "Personnaliser Évolution du solde",
        }),
      ),
    );
    expect(
      screen.getByRole("group", { name: "Taille de Évolution du solde" }),
    ).toBeTruthy();
  });

  it("annuler abandonne une disposition modifiée sans toucher à la sauvegarde", async () => {
    const s = structuredClone(emptySnapshot);
    s.preferences.widgets = ["chart", "available"];
    await db.preferences.put(s.preferences);
    const finish = vi.fn();
    renderBoard(s, finish);
    fireEvent.click(
      screen.getByRole("button", { name: "Retirer Disponible à dépenser" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(finish).toHaveBeenCalledOnce();
    expect((await db.preferences.get("main"))?.widgets).toEqual([
      "chart",
      "available",
    ]);
  });
});

describe("Lisibilité du graphique par période et largeur", () => {
  it("espace les libellés, y compris la dernière date, sur mobile et sur un an", () => {
    for (const length of [1, 2, 30, 123, 365]) {
      for (const width of [280, 390, 600, 1000]) {
        const ticks = chartTicks(length, width);
        expect(ticks[0]).toBe(0);
        expect(ticks.at(-1)).toBe(length - 1);
        expect(new Set(ticks).size).toBe(ticks.length);
        for (let i = 1; i < ticks.length; i++) {
          const physicalGap =
            ((ticks[i] - ticks[i - 1]) * (width - 100)) / (length - 1);
          expect(physicalGap).toBeGreaterThanOrEqual(65);
        }
      }
    }
    expect(chartTicks(0, 390)).toEqual([]);
  });

  it("décrit honnêtement les récurrences détectées dans la projection", () => {
    render(
      <BalanceChart
        points={[{ date: "2026-10-20", value: 120000, future: true }]}
        safety={10000}
        showTable={false}
      />,
    );
    expect(
      screen.getByText(/échéances saisies et récurrences détectées/),
    ).toBeTruthy();
  });
});
