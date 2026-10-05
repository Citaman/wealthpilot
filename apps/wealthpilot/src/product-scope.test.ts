import { describe, expect, it } from "vitest";
import { defaultPreferences } from "./types";
import { migrateBoard, validateBoardState } from "./layout";
import { activeBoard, activeWidgetIds, isActiveWidget } from "./productScope";

describe("Périmètre réduit, sans effacement des données", () => {
  it("retire les cinq familles de projets de toutes les dispositions et du catalogue", () => {
    const preferences = structuredClone(defaultPreferences);
    preferences.widgets = [
      "balance",
      "goal",
      "goals",
      "goalDate",
      "effort",
      "savings",
      "transactions",
    ];
    preferences.goal = {
      name: "Projet conservé",
      target: 120000,
      saved: 30000,
      monthly: 10000,
    };
    const stored = migrateBoard(preferences);
    const before = JSON.stringify({ preferences, stored });
    const visible = activeBoard(stored);
    expect(visible.views[0].instances.map((i) => i.type)).toEqual([
      "balance",
      "transactions",
    ]);
    expect(visible.legacy.widgets).toEqual(["balance", "transactions"]);
    for (const positions of Object.values(visible.views[0].layouts))
      expect(positions).toHaveLength(2);
    expect(visible.views[0].mobileOrder).toHaveLength(2);
    expect(validateBoardState(visible)).toBe(true);
    expect(JSON.stringify({ preferences, stored })).toBe(before);
    expect(activeWidgetIds).toHaveLength(25);
    expect(
      ["goal", "goals", "goalDate", "effort", "savings"].some((id) =>
        activeWidgetIds.includes(id as never),
      ),
    ).toBe(false);
    expect(isActiveWidget("budgets")).toBe(true);
  });
});
