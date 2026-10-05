import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DataViz } from "./DataViz";
import { visualizationsFor } from "./visualizationRegistry";
import { BoardInstanceContext } from "./BoardInstanceContext";
import { makeInstance, validateBoardState, migrateBoard } from "./layout";
import { defaultPreferences } from "./types";
import { distinctSeriesColors, readableMarkColor } from "./visual";

describe("Représentations propres à la question financière", () => {
  it("sépare huit identités automatiques, Autres inclus, sans recolorer au réordonnancement", () => {
    const names = [
      "Télécom",
      "À classer",
      "Shopping",
      "Courses",
      "Maison",
      "Santé",
      "Transport",
      "Autres",
    ];
    const colors = distinctSeriesColors(names);
    expect(new Set(Object.values(colors)).size).toBe(8);
    expect(distinctSeriesColors([...names].reverse())).toEqual(colors);
    const extended = [...names, "Revenus", "Enfants", "Loisirs", "Logement"];
    expect(new Set(Object.values(distinctSeriesColors(extended))).size).toBe(
      12,
    );
    const surfaces = {
      paper: "#f3eddf",
      ink: "#25221d",
      yellow: "#f2d16b",
      pink: "#e8c5db",
      cyan: "#bcdce0",
    };
    const luminance = (hex: string) =>
      [1, 3, 5]
        .map((at) => parseInt(hex.slice(at, at + 2), 16) / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce(
          (sum, v, index) => sum + v * [0.2126, 0.7152, 0.0722][index],
          0,
        );
    for (const [tone, surface] of Object.entries(surfaces)) {
      expect(
        new Set(
          Object.values(colors).map((color) => readableMarkColor(color, tone)),
        ).size,
      ).toBe(8);
      for (const color of Object.values(colors)) {
        const fg = luminance(readableMarkColor(color, tone)),
          bg = luminance(surface);
        expect(
          (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05),
        ).toBeGreaterThanOrEqual(3);
      }
    }
    const v = render(
      <DataViz
        widget="categories"
        initial="waffle"
        limit={3}
        items={names.slice(0, 4).map((name) => ({ name, value: 100 }))}
      />,
    );
    const marks = [
      ...v.container.querySelectorAll<HTMLElement>(".share-legend li"),
    ].map((li) => li.style.getPropertyValue("--item-color"));
    expect(new Set(marks).size).toBe(4);
  });
  it("cascade espace les graduations près de zéro et conserve le net exact dans la légende", () => {
    const v = render(
      <DataViz
        widget="flows"
        initial="waterfall"
        limit={3}
        items={[
          { name: "Revenus", value: 250000 },
          { name: "Dépenses", value: 253564 },
          { name: "Net", value: -3564 },
        ]}
      />,
    );
    const ticks = [
      ...v.container.querySelectorAll("svg text[text-anchor='end']"),
    ];
    expect(ticks).toHaveLength(2);
    expect(
      Math.abs(
        Number(ticks[0].getAttribute("y")) - Number(ticks[1].getAttribute("y")),
      ),
    ).toBeGreaterThanOrEqual(16);
    expect(ticks.some((tick) => tick.textContent?.startsWith("0"))).toBe(true);
    expect(v.container.querySelector(".column-viz ol")?.textContent).toMatch(
      /-35,64/,
    );
  });
  it("ne distribue pas le même ensemble de vues à tous les composants", () => {
    expect(visualizationsFor("categories")).toEqual([
      "bars",
      "rings",
      "stacked",
      "waffle",
      "tiles",
    ]);
    expect(visualizationsFor("flows")).toEqual([
      "bars",
      "columns",
      "waterfall",
    ]);
    expect(visualizationsFor("charges")).toEqual(["bars", "timeline", "tiles"]);
    expect(visualizationsFor("goals")).toEqual([
      "bars",
      "rings",
      "tiles",
      "bullet",
    ]);
  });
  it("mosaïque conserve les catégories masquées dans Autres et répartit exactement100cases", () => {
    const v = render(
      <DataViz
        widget="categories"
        initial="waffle"
        limit={2}
        items={[
          { name: "A", value: 3300 },
          { name: "B", value: 3300 },
          { name: "C", value: 3400 },
        ]}
      />,
    );
    expect(v.container.querySelectorAll(".waffle-grid i")).toHaveLength(100);
    expect(screen.getByText("Autres")).toBeTruthy();
    expect(screen.getByText("34 %")).toBeTruthy();
    expect(v.container.querySelectorAll(".viz-track-bar")).toHaveLength(0);
  });
  it("répartition et mosaïque refusent de transformer un solde négatif en part positive", () => {
    for (const initial of ["stacked", "waffle"] as const) {
      const v = render(
        <DataViz
          widget="categories"
          initial={initial}
          limit={5}
          items={[
            { name: "Retour", value: -100 },
            { name: "Achat", value: 200 },
          ]}
        />,
      );
      expect(v.container.querySelector(".viz-composition-bars")).toBeTruthy();
      expect(v.container.textContent).toContain("-1");
      v.unmount();
    }
  });
  it("cascade refuse un net incohérent et dessine un vrai pont revenus-dépenses-net", () => {
    const v = render(
      <DataViz
        widget="flows"
        initial="waterfall"
        limit={3}
        items={[
          { name: "Revenus", value: 100000 },
          { name: "Dépenses", value: 70000 },
          { name: "Net", value: 30000 },
        ]}
      />,
    );
    expect(screen.getByRole("img", { name: /Cascade/ })).toBeTruthy();
    expect(v.container.querySelectorAll("svg rect")).toHaveLength(3);
    v.rerender(
      <DataViz
        widget="flows"
        initial="waterfall"
        limit={3}
        items={[
          { name: "Revenus", value: 100000 },
          { name: "Dépenses", value: 70000 },
          { name: "Net", value: 90000 },
        ]}
      />,
    );
    expect(v.container.querySelector(".viz-composition-bars")).toBeTruthy();
  });
  it("cible visible reste à100% mais les dépassements réels ne sont pas tronqués", () => {
    const v = render(
      <DataViz
        widget="goals"
        initial="bullet"
        limit={3}
        items={[{ name: "Maison", value: 15000, target: 10000 }]}
      />,
    );
    expect(screen.getByText("150 %")).toBeTruthy();
    expect(
      v.container.querySelector<HTMLElement>(".bullet-target")?.style.left,
    ).toMatch(/^66/);
    v.rerender(
      <DataViz
        widget="goals"
        initial="bullet"
        limit={3}
        items={[{ name: "Maison", value: 15000 }]}
      />,
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Cibles — goals",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
  it("échéancier groupe les montants par date réelle et conserve les estimations", () => {
    const v = render(
      <DataViz
        widget="charges"
        initial="timeline"
        limit={3}
        items={[
          {
            name: "Internet",
            value: 3000,
            date: "2026-10-12",
            detail: "Estimée",
          },
          { name: "Assurance", value: 2000, date: "2026-10-12" },
          { name: "Loyer", value: 50000, date: "2026-10-06" },
        ]}
      />,
    );
    expect(v.container.querySelectorAll("time")).toHaveLength(2);
    expect(v.container.querySelector("time")?.dateTime).toBe("2026-10-06");
    expect(screen.getByText("Estimée")).toBeTruthy();
    expect(screen.getByText(/^50\s*€$/)).toBeTruthy();
  });
  it("nouvelle représentation persiste uniquement sur l’instance et survit au rechargement de son contexte", async () => {
    const instance = makeInstance("categories", "test"),
      update = vi.fn().mockResolvedValue(undefined);
    const v = render(
      <BoardInstanceContext.Provider value={{ instance, update }}>
        <DataViz
          widget="categories"
          limit={3}
          items={[{ name: "A", value: 10000 }]}
        />
      </BoardInstanceContext.Provider>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Mosaïque — categories" }),
    );
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({ representation: "waffle" }),
    );
    v.rerender(
      <BoardInstanceContext.Provider
        value={{ instance: { ...instance, representation: "waffle" }, update }}
      >
        <DataViz
          widget="categories"
          limit={3}
          items={[{ name: "A", value: 10000 }]}
        />
      </BoardInstanceContext.Provider>,
    );
    expect(v.container.querySelector(".waffle-grid")).toBeTruthy();
    const board = migrateBoard(defaultPreferences);
    board.views[0].instances[0].representation = "waffle";
    expect(validateBoardState(board)).toBe(true);
  });
});
