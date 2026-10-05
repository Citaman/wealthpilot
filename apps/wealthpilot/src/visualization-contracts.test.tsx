import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DataViz } from "./DataViz";
import { BoardInstanceContext } from "./BoardInstanceContext";
import { makeInstance } from "./layout";
import { readableMarkColor } from "./visual";
import { goalColors } from "./GoalIdentity";
import {
  visualizationsFor,
  visualizationLabels,
} from "./visualizationRegistry";
describe("C1 — contrats sémantiques des représentations par composant", () => {
  it("toutes les couleurs de projet et les extrêmes personnalisés restent lisibles sur cinq surfaces", () => {
    const lum = (hex: string) =>
      [1, 3, 5]
        .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i], 0);
    for (const [tone, surface] of Object.entries({
      paper: "#f3eddf",
      ink: "#25221d",
      yellow: "#f2d16b",
      pink: "#e8c5db",
      cyan: "#bcdce0",
    }))
      for (const color of [...goalColors, "#ffffff", "#000000", "#faff00"]) {
        const adjusted = readableMarkColor(color, tone),
          values = [lum(adjusted), lum(surface)].sort((a, b) => b - a);
        expect((values[0] + 0.05) / (values[1] + 0.05)).toBeGreaterThanOrEqual(
          3,
        );
      }
  });
  // Real-browser matrix covers every widget/size/positive representation.
  // Retain four distinct semantic boundaries here: signed balances, shares,
  // target progress, and flows. Repeating the same renderer for aliases adds
  // no independent regression protection.
  it.each(["balance", "categories", "goals", "flows"] as const)(
    "%s expose uniquement ses vues légitimes, les change et ne modifie que son instance",
    async (id) => {
      const update = vi.fn().mockResolvedValue(undefined),
        instance = makeInstance(id, "test-instance");
      const view = render(
        <BoardInstanceContext.Provider value={{ instance, update }}>
          <DataViz
            widget={id}
            limit={10}
            items={[
              { name: "A", value: 20000, target: 40000, date: "2026-10-06" },
              { name: "B", value: 10000, target: 20000, date: "2026-10-07" },
              { name: "Net", value: 10000, target: 10000, date: "2026-10-08" },
            ]}
          />
        </BoardInstanceContext.Provider>,
      );
      const alternatives = visualizationsFor(id).map(
        (v) => visualizationLabels[v],
      );
      const expected = alternatives.length > 1 ? alternatives : [];
      expect(
        screen
          .queryAllByRole("button")
          .map((b) => b.getAttribute("aria-label")),
      ).toEqual(expected.map((name) => name + " — " + id));
      for (const name of expected) {
        fireEvent.click(
          screen.getByRole("button", { name: name + " — " + id }),
        );
        const representation = visualizationsFor(id).find(
          (v) => visualizationLabels[v] === name,
        );
        await waitFor(() =>
          expect(update).toHaveBeenLastCalledWith({ representation }),
        );
        expect(
          screen
            .getByRole("button", { name: name + " — " + id })
            .getAttribute("aria-pressed"),
        ).toBe("true");
        expect(view.container.textContent).toMatch(/200.*100/);
      }
      for (const representation of ["rings", "tiles"] as const) {
        view.rerender(
          <BoardInstanceContext.Provider
            value={{ instance: { ...instance, representation }, update }}
          >
            <DataViz
              widget={id}
              limit={10}
              items={[
                { name: "A", value: -20000 },
                { name: "B", value: 10000 },
              ]}
            />
          </BoardInstanceContext.Provider>,
        );
        const unavailable =
          representation === "rings" ||
          !visualizationsFor(id).includes("tiles");
        if (unavailable) {
          expect(view.container.querySelector(".concentric-chart")).toBeNull();
          expect(view.container.querySelector(".viz-bars")).toBeTruthy();
        }
        expect(view.container.textContent).toMatch(/-200/);
      }
    },
  );
  it("revient à la vue précédente si la sauvegarde échoue, sans prétendre qu’elle est enregistrée", async () => {
    const update = vi.fn().mockRejectedValue(new Error("Autre onglet"));
    render(
      <BoardInstanceContext.Provider
        value={{ instance: makeInstance("categories", "failure"), update }}
      >
        <DataViz
          widget="categories"
          limit={5}
          items={[{ name: "Courses", value: 100 }]}
        />
      </BoardInstanceContext.Provider>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Anneaux — categories" }),
    );
    await screen.findByRole("alert");
    expect(
      screen
        .getByRole("button", { name: "Lignes — categories" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });
  it("ignore une ancienne vue incompatible et conserve un état vide explicite", () => {
    const view = render(
      <DataViz widget="flows" initial="rings" limit={5} items={[]} />,
    );
    expect(view.container.querySelector(".concentric-chart")).toBeNull();
    expect(screen.getByText("Aucune donnée sur cette période.")).toBeTruthy();
    view.rerender(
      <DataViz
        widget="balance"
        initial="tiles"
        limit={1}
        items={[
          { name: "Compte avec un intitulé très long", value: 123456789 },
          { name: "B", value: 0 },
        ]}
      />,
    );
    expect(view.container.querySelector(".viz-tiles")).toBeTruthy();
    expect(screen.getByText(/1 sur 2/)).toBeTruthy();
    expect(view.container.textContent).not.toMatch(/NaN|Infinity/);
  });
});
