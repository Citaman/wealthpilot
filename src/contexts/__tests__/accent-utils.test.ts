import { describe, expect, it } from "vitest";
import { contrastRatio, foregroundFor, normalizeAccent, type Rgb } from "../accent-utils";
import { parseCustomAccentPresets } from "../accent-context";

describe("palette d’accent accessible", () => {
  const samples: Rgb[] = [[255, 107, 74], [52, 199, 89], [142, 142, 147], [255, 238, 0]];

  it.each(samples.map((sample) => [sample] as const))("normalise %j en clair", (sample) => {
    const accent = normalizeAccent(sample, "light");
    expect(contrastRatio(accent, [255, 255, 255])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(accent, foregroundFor(accent))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(samples.map((sample) => [sample] as const))("normalise %j en sombre", (sample) => {
    const accent = normalizeAccent(sample, "dark");
    expect(contrastRatio(accent, [12, 18, 28])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(accent, foregroundFor(accent))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("palettes personnalisées stockées", () => {
  it("ignore les entrées corrompues et renormalise les couleurs valides", () => {
    const presets = parseCustomAccentPresets(JSON.stringify([
      { id: "custom-safe", name: "  Test  ", hex: "#ffef00", light: "0 0 0", dark: "0 0 0" },
      { id: "builtin-injection", name: "Non", hex: "#000000" },
      { id: "custom-bad", name: "Non", hex: "javascript:red" },
    ]));

    expect(presets).toHaveLength(1);
    expect(presets[0]?.name).toBe("Test");
    expect(contrastRatio(presets[0]!.light.split(" ").map(Number) as Rgb, [255, 255, 255])).toBeGreaterThanOrEqual(4.5);
  });
});
