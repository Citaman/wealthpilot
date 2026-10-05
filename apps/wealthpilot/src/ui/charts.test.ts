import { describe, expect, it } from "vitest";
import { overlaps, placeAnnotations, truncate } from "./charts/annotations";
import { dateTicks, niceTicks } from "./charts/scales";

describe("niceTicks", () => {
  it("gives four round euro ticks for a 0 → 6 000 € range", () => {
    expect(niceTicks(0, 600_000, 4)).toEqual([0, 200_000, 400_000, 600_000]);
  });

  it("covers both ends with a round step and little wasted range", () => {
    const ticks = niceTicks(-521_000, 483_000, 5);
    expect(ticks).toEqual([-750_000, -500_000, -250_000, 0, 250_000, 500_000]);
  });

  it("never steps below one euro and always includes the extent", () => {
    for (const [min, max] of [
      [1_234, 5_678],
      [-90_000, -10_000],
      [12_345, 9_876_543],
    ]) {
      const ticks = niceTicks(min, max, 4);
      expect(ticks[0]).toBeLessThanOrEqual(min);
      expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(max);
      expect(ticks.length).toBeGreaterThanOrEqual(3);
      expect(ticks.length).toBeLessThanOrEqual(6);
      ticks.forEach((t) => expect(Math.abs(t % 100)).toBe(0));
    }
  });

  it("pads a flat series", () => {
    const ticks = niceTicks(240_000, 240_000);
    expect(ticks[0]).toBeLessThan(240_000);
    expect(ticks[ticks.length - 1]).toBeGreaterThan(240_000);
  });
});

describe("dateTicks", () => {
  it("keeps both ends and adapts the count to the width", () => {
    expect(dateTicks("2026-09-18", "2026-10-31", 280)).toHaveLength(3);
    const wide = dateTicks("2026-09-18", "2026-10-31", 1200);
    expect(wide).toHaveLength(6);
    expect(wide[0]).toBe("2026-09-18");
    expect(wide[5]).toBe("2026-10-31");
  });
});

describe("placeAnnotations", () => {
  const bounds = { x: 60, y: 10, width: 400, height: 200 };

  it("keeps a long label next to the y axis inside the plot, truncated", () => {
    const [placed] = placeAnnotations(
      [
        {
          id: "a",
          x: 60,
          y: 120,
          label: "Ouverture du compte Joint · solde initial importé",
        },
      ],
      { bounds, maxWidth: 160 },
    );
    expect(placed.box.x).toBeGreaterThanOrEqual(bounds.x);
    expect(placed.box.width).toBeLessThanOrEqual(160);
    expect(placed.text.endsWith("…")).toBe(true);
  });

  it("never lets labels overlap each other, the obstacles or leave the plot", () => {
    const obstacle = { x: 330, y: 92, width: 130, height: 16 };
    const anchors = [
      { id: "1", x: 300, y: 100, label: "Point bas 940 €" },
      { id: "2", x: 310, y: 104, label: "Salaire Sam +1 200 €" },
      { id: "3", x: 320, y: 98, label: "Loyer −920 €" },
      { id: "4", x: 450, y: 30, label: "Fin du mois 2 180 €" },
    ];
    const placed = placeAnnotations(anchors, { bounds, obstacles: [obstacle] });
    expect(placed.length).toBeGreaterThanOrEqual(3);
    for (const [i, p] of placed.entries()) {
      expect(overlaps(p.box, obstacle)).toBe(false);
      expect(p.box.x).toBeGreaterThanOrEqual(bounds.x);
      expect(p.box.x + p.box.width).toBeLessThanOrEqual(
        bounds.x + bounds.width,
      );
      expect(p.box.y).toBeGreaterThanOrEqual(bounds.y);
      expect(p.box.y + p.box.height).toBeLessThanOrEqual(
        bounds.y + bounds.height,
      );
      for (const q of placed.slice(i + 1))
        expect(overlaps(p.box, q.box)).toBe(false);
    }
  });

  it("truncates with an ellipsis", () => {
    expect(truncate("Salaire Atelier Nord", 72)).toBe("Salaire A…");
    expect(truncate("Loyer", 72)).toBe("Loyer");
  });
});
