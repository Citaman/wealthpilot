import { describe, expect, it } from "vitest";
import { defaultLayout, readLayout, rowSpans } from "./layout";

describe("readLayout", () => {
  it("falls back to the default layout", () => {
    expect(readLayout(undefined).cards.map((c) => [c.type, c.width])).toEqual(
      defaultLayout().cards.map((c) => [c.type, c.width]),
    );
  });
  it("drops unknown types, fits widths, keeps ids unique", () => {
    const layout = readLayout({
      version: 2,
      cards: [
        { id: "a", type: "balance", width: 4 },
        { id: "a", type: "available", width: 12, palette: "nope" },
        { id: "b", type: "goal", width: 6 },
        { id: "c", type: "accounts", width: 4, account: "Commun" },
      ],
    });
    expect(layout.cards.map((c) => [c.type, c.width])).toEqual([
      ["balance", 6],
      ["available", 6],
      ["accounts", 4],
    ]);
    expect(new Set(layout.cards.map((c) => c.id)).size).toBe(3);
    expect(layout.cards[1].palette).toBe("ink");
    expect(layout.cards[2].account).toBeUndefined();
  });
});

describe("rowSpans", () => {
  it("fills incomplete rows up to each card's widest width", () => {
    const cards = [
      { type: "balance", width: 8 },
      { type: "envelopes", width: 6 },
      { type: "week", width: 4 },
    ] as const;
    expect(rowSpans(cards, "desktop")).toEqual([12, 6, 6]);
    expect(rowSpans(cards, "tablet")).toEqual([12, 6, 6]);
  });
});
