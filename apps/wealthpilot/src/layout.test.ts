import { describe, expect, it } from "vitest";
import { defaultPreferences } from "./types";
import {
  addInstance,
  appendPosition,
  boardBreakpoint,
  duplicateView,
  makeInstance,
  migrateBoard,
  positionChange,
  readingOrder,
  removeInstance,
  validateBoardState,
  dimensions,
  resizeInstance,
  overlaps,
  settleLayout,
  upgradeGeometry,
  fitContentLayout,
  compactBoard,
  verticalNeighbourPosition,
} from "./layout";

describe("Grille compacte — trente instances sans collision", () => {
  it("referme les anciens trous sans perdre identités, colonnes ou dimensions", () => {
    let layout = migrateBoard({ ...defaultPreferences, widgets: [] }).views[0]
      .layouts.laptop;
    for (let n = 0; n < 30; n++)
      layout = appendPosition(
        layout,
        makeInstance("balance", `test-${n}`),
        "laptop",
      );
    layout = layout.map((p, n) => ({
      ...p,
      x: n % 2 ? 12 : 0,
      y: 200 + n * 40,
    }));
    const before = structuredClone(layout);
    const compacted = settleLayout(layout);
    expect(layout).toEqual(before);
    expect(settleLayout(compacted)).toEqual(compacted);
    expect(layout).toHaveLength(30);
    expect(compacted[0].y).toBe(0);
    expect(compacted[1].y).toBe(0);
    expect(compacted[2].y).toBe(compacted[0].h + 2);
    expect(compacted.map(({ i, x, w, h }) => ({ i, x, w, h }))).toEqual(
      layout.map(({ i, x, w, h }) => ({ i, x, w, h })),
    );
    const moved = positionChange(compacted, "test-10", {
      x: 11,
      y: compacted[10].y + 1,
    });
    expect(moved?.[10].x).toBe(11);
    const pushed = positionChange(compacted, "test-10", { x: 0, y: 0 })!;
    expect(pushed[10].y).toBe(0);
    expect(pushed[0].y).toBeGreaterThan(pushed[10].y + pushed[10].h);
    expect(pushed.some((a) => pushed.some((b) => overlaps(a, b)))).toBe(false);
  });
});
describe("Tailles physiques et compactage des voisins", () => {
  it("conserve les contraintes valides des sauvegardes lors du compactage", () => {
    const board = migrateBoard({ ...defaultPreferences, widgets: ["balance"] });
    for (const layout of Object.values(board.views[0].layouts)) {
      Object.assign(layout[0], { minH: 50, h: 100 });
    }
    const compacted = compactBoard(board);
    expect(validateBoardState(compacted)).toBe(true);
    expect(compacted.views[0].layouts.laptop[0].h).toBe(50);
    expect(fitContentLayout(compacted.views[0], "laptop", {})[0].h).toBe(50);
  });
  it("les flèches verticales traversent la voisine, pas une ligne qui se recompacterait", () => {
    const layout = [
      { ...dimensions(makeInstance("balance"), "laptop"), i: "a", x: 0, y: 0 },
      { ...dimensions(makeInstance("balance"), "laptop"), i: "b", x: 0, y: 30 },
      {
        ...dimensions(makeInstance("balance"), "laptop"),
        i: "other",
        x: 12,
        y: 0,
      },
    ];
    const target = verticalNeighbourPosition(layout, "a", 1)!;
    const moved = positionChange(layout, "a", target)!;
    expect(moved.find((p) => p.i === "b")!.y).toBe(0);
    expect(moved.find((p) => p.i === "a")!.y).toBe(30);
    const reverted = positionChange(
      moved,
      "a",
      verticalNeighbourPosition(moved, "a", -1)!,
    )!;
    expect(reverted).toEqual(layout);
    expect(verticalNeighbourPosition(layout, "a", -1)).toBeNull();
    expect(verticalNeighbourPosition(layout, "other", 1)).toBeNull();
  });
  it("Mini a la moitié des colonnes et des lignes de Moyen sur un portable", () => {
    const i = makeInstance("balance");
    const tiny = dimensions({ ...i, size: "tiny" }, "laptop");
    const medium = dimensions({ ...i, size: "medium" }, "laptop");
    expect(tiny.w * 2).toBe(medium.w);
    expect(tiny.h * 2).toBe(medium.h);
    expect(
      dimensions({ ...i, type: "budgets", size: "small" }, "laptop").w,
    ).toBeLessThan(medium.w);
  });
  it("agrandir lie contenu et dimensions, conserve l’ancrage et pousse en cascade", () => {
    const view = migrateBoard({
      ...defaultPreferences,
      widgets: ["balance", "available", "dues"],
    }).views[0];
    const next = resizeInstance(view, "legacy-balance", "large");
    expect(next.instances[0].size).toBe("large");
    expect(next.layouts.laptop[0]).toMatchObject({ x: 0, y: 0, w: 16 });
    expect(next.layouts.laptop[1].y).toBeGreaterThan(0);
    expect(
      next.layouts.laptop.every(
        (a) => !next.layouts.laptop.some((b) => overlaps(a, b)),
      ),
    ).toBe(true);
    expect(view.instances[0].size).toBe("medium");
  });
  it("préserve les colonnes mais supprime les trous verticaux après agrandissement puis repli", () => {
    const view = migrateBoard({
      ...defaultPreferences,
      widgets: ["balance", "available"],
    }).views[0];
    const positions = view.layouts.laptop.map((p, index) => ({
      ...p,
      x: 2,
      y: index * 40,
      w: 8,
    }));
    const moved = positionChange(positions, positions[0].i, { x: 3, y: 4 })!;
    expect(moved[1]).toMatchObject({ x: 2, y: 30 });
    const expanded = settleLayout(
      moved.map((p, index) => (index ? p : { ...p, h: 60 })),
    );
    expect(expanded[0]).toMatchObject({ x: 3, y: 0 });
    expect(expanded[1]).toMatchObject({ x: 2, y: 62 });
    expect(settleLayout(expanded)).toEqual(expanded);
    const collapsed = settleLayout(
      expanded.map((p, index) => (index ? p : { ...p, h: 14 })),
    );
    expect(collapsed[1]).toMatchObject({ x: 2, y: 16 });
  });
  it("les mesures intrinsèques diminuent et une ancienne hauteur enregistrée ne devient jamais un minimum", () => {
    const board = migrateBoard({
      ...defaultPreferences,
      widgets: ["balance", "available"],
    });
    const view = board.views[0];
    view.layouts.laptop = view.layouts.laptop.map((p, i) => ({
      ...p,
      x: 0,
      y: i * 240,
      h: 200,
    }));
    const before = structuredClone(board);
    const normalized = compactBoard(board);
    expect(board).toEqual(before);
    expect(validateBoardState(normalized)).toBe(true);
    const expanded = fitContentLayout(normalized.views[0], "laptop", {
      "legacy-balance": 900,
    });
    expect(expanded[0].h).toBe(75);
    expect(expanded[1].y).toBe(77);
    const collapsed = fitContentLayout(normalized.views[0], "laptop", {
      "legacy-balance": 120,
    });
    expect(collapsed[0].h).toBe(28);
    expect(collapsed[1].y).toBe(30);
  });
  it("la mise à niveau ne réécrit pas la sauvegarde et se fait une seule fois", () => {
    const old = migrateBoard(defaultPreferences);
    delete old.geometryVersion;
    old.views[0].layouts.laptop[0].h = 100;
    const upgraded = upgradeGeometry(old);
    expect(old.views[0].layouts.laptop[0].h).toBe(100);
    expect(upgraded.views[0].layouts.laptop[0].h).toBeLessThan(100);
    expect(upgradeGeometry(upgraded)).toBe(upgraded);
    expect(validateBoardState(upgraded)).toBe(true);
  });
});
describe("G1 — disposition sans effet métier", () => {
  it("migre déterministement sans modifier l’ancienne configuration et valide toutes les tailles", () => {
    const preferences = structuredClone(defaultPreferences);
    const before = structuredClone(preferences);
    const board = migrateBoard(preferences);
    expect(board).toEqual(migrateBoard(preferences));
    expect(validateBoardState(board)).toBe(true);
    expect(preferences).toEqual(before);
    expect(board.legacy.widgets).toEqual(before.widgets);
  });
  it("refuse chevauchement, identités répétées, hors bornes et NaN avant activation", () => {
    const board = migrateBoard({
      ...defaultPreferences,
      widgets: ["available", "budgets"],
    });
    const overlap = structuredClone(board);
    overlap.views[0].layouts.laptop[1].x = 0;
    expect(validateBoardState(overlap)).toBe(false);
    for (const value of [NaN, -1, 24, Infinity]) {
      const bad = structuredClone(board);
      bad.views[0].layouts.laptop[0].x = value;
      expect(validateBoardState(bad)).toBe(false);
    }
    board.views[0].instances[1].id = board.views[0].instances[0].id;
    expect(validateBoardState(board)).toBe(false);
  });
  it("ajout et suppression conservent données et identités tout en refermant l’espace", () => {
    const view = migrateBoard(defaultPreferences).views[0];
    const added = addInstance(view, makeInstance("available", "second"));
    expect(added.layouts.laptop.slice(0, -1)).toEqual(view.layouts.laptop);
    expect(removeInstance(added, "second")).toEqual(view);
    expect(added.instances.filter((i) => i.type === "available")).toHaveLength(
      2,
    );
    const removed = removeInstance(added, added.instances[0].id);
    expect(removed.layouts.laptop[0].y).toBe(0);
  });
  it("copie une vue avec des instances indépendantes sans toucher à l’original", () => {
    const original = migrateBoard(defaultPreferences).views[0];
    const copy = duplicateView(original, "Autre vue");
    expect(
      copy.instances.every(
        (i) => !original.instances.some((j) => j.id === i.id),
      ),
    ).toBe(true);
    copy.instances[0].source = { kind: "account", account: "Conjoint" };
    expect(original.instances[0].source.kind).toBe("global");
    expect(
      validateBoardState({
        ...migrateBoard(defaultPreferences),
        views: [original, copy],
      }),
    ).toBe(true);
    const invalidCopy = structuredClone(original);
    invalidCopy.id = "a-second-view";
    expect(
      validateBoardState({
        ...migrateBoard(defaultPreferences),
        views: [original, invalidCopy],
      }),
    ).toBe(false);
  });
  it("garde les layouts séparés et l’ordre de lecture spatial déterministe", () => {
    const board = migrateBoard({
      ...defaultPreferences,
      widgets: ["available", "balance"],
    });
    const view = board.views[0];
    const desktop = structuredClone(view.layouts.desktop);
    view.layouts.laptop[0].y = 100;
    expect(readingOrder(view, "laptop")).toEqual([
      "legacy-balance",
      "legacy-available",
    ]);
    expect(view.layouts.desktop).toEqual(desktop);
    expect([500, 1400, 1800, 2800].map(boardBreakpoint)).toEqual([
      "laptop",
      "laptop",
      "desktop",
      "wide",
    ]);
  });
});
