import { describe, expect, it } from "vitest";
import {
  cardPaletteIds,
  cardPalettes,
  cardPaletteClassName,
  cardPaletteStyle,
  contrastRatio,
  getCardPalette,
  isCardPaletteId,
} from "./cardPalettes";
import { readableMarkColor } from "./visual";
import { defaultPreferences, emptySnapshot } from "./types";
import { migrateBoard, validateBoardState } from "./layout";
import { validateBackup } from "./store";

describe("Palettes de cartes — contrats complets, pas des fonds isolés", () => {
  it("utilise un calcul WCAG vérifié contre des ratios connus", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBe(21);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.478, 3);
    expect(contrastRatio("#ffffff", "#777777")).toBeCloseTo(4.478, 3);
    expect(contrastRatio("#123456", "#123456")).toBe(1);
  });

  it("offre douze ensembles distincts et garde les cinq identifiants historiques", () => {
    expect(cardPaletteIds).toHaveLength(12);
    expect(cardPaletteIds).toEqual(
      expect.arrayContaining(["paper", "ink", "yellow", "pink", "cyan"]),
    );
    expect(
      new Set(cardPaletteIds.map((id) => cardPalettes[id].surface)).size,
    ).toBe(12);
    expect(cardPaletteIds.filter((id) => cardPalettes[id].dark)).toHaveLength(
      4,
    );
    expect(isCardPaletteId("constructor")).toBe(false);
    expect(isCardPaletteId(null)).toBe(false);
    expect(getCardPalette("unknown")).toBe(cardPalettes.paper);
  });

  it.each(cardPaletteIds)(
    "%s : texte, contrôles, états et séries restent lisibles",
    (id) => {
      const p = cardPalettes[id];
      for (const surface of [p.surface, p.raised]) {
        for (const color of [p.foreground, p.muted]) {
          expect(
            contrastRatio(color, surface),
            `${id}: ${color} sur ${surface}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
      expect(contrastRatio(p.onAccent, p.accent)).toBeGreaterThanOrEqual(4.5);
      for (const color of [p.border, p.focus, ...p.series]) {
        expect(
          contrastRatio(color, p.surface),
          `${id}: marque ${color}`,
        ).toBeGreaterThanOrEqual(3);
      }
      for (const color of p.series)
        expect(contrastRatio(color, p.track)).toBeGreaterThanOrEqual(3);
      for (const color of [p.positive, p.negative])
        expect(contrastRatio(color, p.surface)).toBeGreaterThanOrEqual(4.5);
      for (const chosenColor of [
        "#ffffff",
        "#000000",
        "#aaaaaa",
        "#187080",
        "#efc445",
        "#9b446f",
        "#7552a4",
      ]) {
        expect(
          contrastRatio(readableMarkColor(chosenColor, id), p.surface),
        ).toBeGreaterThanOrEqual(3);
        expect(
          contrastRatio(readableMarkColor(chosenColor, id), p.track),
        ).toBeGreaterThanOrEqual(3);
      }
      expect(readableMarkColor("var(--series-1)", id)).toBe("var(--series-1)");
      const style = cardPaletteStyle(id) as Record<string, string>;
      expect(style["--card-foreground"]).toBe(p.foreground);
      expect(style["--card-accent"]).toBe(p.accent);
      expect(style["--card-series-2"]).toBe(p.series[1]);
      expect(style.colorScheme).toBe(p.dark ? "dark" : "light");
      expect(cardPaletteClassName(id)).toBe(`card-palette palette-${id}`);
    },
  );

  it("garde un premier plan clair complet pour chaque palette sombre, sans montant jaune imposé", () => {
    for (const p of Object.values(cardPalettes).filter(
      (palette) => palette.dark,
    )) {
      expect(contrastRatio(p.foreground, p.surface)).toBeGreaterThan(7);
      expect(p.foreground).not.toBe(p.accent);
    }
    expect(
      new Set(Object.values(cardPalettes).map((p) => p.accent)).size,
    ).toBeGreaterThanOrEqual(10);
  });

  it.each(cardPaletteIds)(
    "%s : restauration de vue et sauvegarde sans perte du choix",
    (tone) => {
      const s = structuredClone(emptySnapshot);
      s.preferences = {
        ...structuredClone(defaultPreferences),
        widgets: ["balance"],
        tones: { balance: tone },
      };
      s.preferences.board = migrateBoard(s.preferences);
      expect(s.preferences.board.views[0].instances[0].tone).toBe(tone);
      expect(validateBoardState(s.preferences.board)).toBe(true);
      const restored = validateBackup({
        format: "wealthpilot-next",
        version: 1,
        data: s,
      });
      expect(restored.preferences.tones?.balance).toBe(tone);
      expect(restored.preferences.board?.views[0].instances[0].tone).toBe(tone);
    },
  );

  it("refuse une palette inconnue dans le board comme dans les préférences", () => {
    const s = structuredClone(emptySnapshot);
    s.preferences.board = migrateBoard({
      ...s.preferences,
      widgets: ["balance"],
    });
    const invalid = JSON.parse(JSON.stringify(s.preferences.board));
    invalid.views[0].instances[0].tone = "neon-from-nowhere";
    expect(validateBoardState(invalid)).toBe(false);
    const backup = {
      format: "wealthpilot-next",
      version: 1,
      data: {
        ...s,
        preferences: {
          ...s.preferences,
          tones: { balance: "neon-from-nowhere" },
        },
      },
    };
    expect(() => validateBackup(backup)).toThrow(/invalide/);
  });
});
