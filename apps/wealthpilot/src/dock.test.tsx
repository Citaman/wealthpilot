import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { Dock } from "./Dock";
import { db, validateBackup } from "./store";
import { defaultPreferences, emptySnapshot } from "./types";
import {
  activePageIds,
  dockPageIds,
  pageLabels,
  resolveActiveRoute,
} from "./navigation";

beforeEach(async () => {
  await db.preferences.clear();
});
describe("Navigation recentrée, sans migration destructive", () => {
  it("affiche exactement quatre destinations avec icônes, Dashboard en premier, sans Plus", () => {
    const navigate = vi.fn();
    render(<Dock route="week" navigate={navigate} />);
    const nav = screen.getByRole("navigation", {
      name: "Navigation principale",
    });
    const buttons = within(nav).getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(
      activePageIds.map((id) => pageLabels[id]),
    );
    buttons.forEach((button, index) => {
      expect(button.querySelector("svg")).toBeTruthy();
      fireEvent.click(button);
      expect(navigate).toHaveBeenLastCalledWith(activePageIds[index]);
    });
    expect(
      screen
        .getByRole("button", { name: "Ma semaine" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(screen.queryByRole("button", { name: "Plus" })).toBeNull();
    expect(
      screen.queryByRole("region", { name: "Toutes les pages" }),
    ).toBeNull();
  });
  it("ne modifie aucune préférence historique lors du rendu ou de la navigation", async () => {
    const before = {
      ...structuredClone(defaultPreferences),
      dockPages: ["goals", "data"] as const,
    };
    await db.preferences.put({ ...before, dockPages: [...before.dockPages] });
    render(<Dock route="dashboard" navigate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Transactions" }));
    expect(await db.preferences.get("main")).toEqual(before);
  });
  it("une URL ancienne est explicitement indisponible plutôt que réinterprétée", () => {
    expect(resolveActiveRoute("")).toBe("dashboard");
    expect(resolveActiveRoute("#week-calculation")).toBe("week");
    for (const page of activePageIds)
      expect(resolveActiveRoute("#" + page)).toBe(page);
    for (const page of dockPageIds.filter(
      (page) => !activePageIds.some((active) => active === page),
    ))
      expect(resolveActiveRoute("#" + page)).toBe("unavailable");
    expect(resolveActiveRoute("#does-not-exist")).toBe("unavailable");
  });
  it("conserve la compatibilité des sauvegardes historiques, sans rendre leurs pages navigables", () => {
    const valid = structuredClone(emptySnapshot);
    valid.preferences.dockPages = ["goals", "data", "references"];
    valid.preferences.widgetViews = { categories: "waffle" };
    expect(
      validateBackup({ format: "wealthpilot-next", version: 1, data: valid }),
    ).toBeTruthy();
    for (const invalid of [
      ["dashboard", "dashboard"],
      ["unknown"],
      [...dockPageIds].slice(0, 6),
      "dashboard",
      [4],
    ]) {
      expect(() =>
        validateBackup({
          format: "wealthpilot-next",
          version: 1,
          data: {
            ...valid,
            preferences: { ...valid.preferences, dockPages: invalid },
          },
        }),
      ).toThrow();
    }
  });
});
