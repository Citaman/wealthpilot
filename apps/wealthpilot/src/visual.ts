import type { Snapshot } from "./types";
import { contrastColor, getCardPalette } from "./cardPalettes";

// Identity selects a palette role, not a ranked position. Reordering or filtering
// must not recolor a category; each card palette still supplies safe contrast.
export function seriesColor(identity: string): string {
  const normalized = identity
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  let hash = 0;
  for (const character of normalized)
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return `var(--series-${(hash % 4) + 1})`;
}

// Allocate from the full (unfiltered) identity set. Sorting prevents reordering
// a legend from changing its colors. Sixteen tones prevent hidden categories
// in a household dataset from consuming the eight principal colors twice.
export function distinctSeriesColors(
  identities: string[],
): Record<string, string> {
  const assigned: Record<string, string> = {};
  const palette = [
    "#187080",
    "#9b446f",
    "#7552a4",
    "#97601d",
    "#345caf",
    "#b14428",
    "#357045",
    "#68615a",
    "#876427",
    "#466c9b",
    "#81638d",
    "#8b493c",
    "#39756c",
    "#6a7140",
    "#a64879",
    "#53578a",
  ];
  const used = new Set<number>();
  for (const identity of [...new Set(identities)].sort()) {
    let role = Number(seriesColor(identity).match(/series-(\d)/)?.[1] ?? 1);
    for (let attempt = 0; attempt < palette.length && used.has(role); attempt++)
      role = (role % palette.length) + 1;
    used.add(role);
    assigned[identity] = palette[role - 1];
  }
  return assigned;
}

// Both budget and spending analysis use the same full household identity set,
// not a ranked or period-filtered subset. Explicit user colors remain primary.
export function categoryPalette(snapshot: Snapshot): Record<string, string> {
  const definitions = snapshot.preferences.categoryDefinitions ?? [];
  const colors = distinctSeriesColors([
    ...snapshot.transactions.map((row) => row.category),
    ...snapshot.budgets.map((row) => row.category),
    ...definitions.map((category) => category.name),
    "Autres",
  ]);
  for (const category of definitions)
    if (category.color) colors[category.name] = category.color;
  return colors;
}

// Keep a chosen hue, but adapt graph marks (not the saved identity) to the card surface.
export function readableMarkColor(color: string, tone = "paper"): string {
  const palette = getCardPalette(tone);
  return contrastColor(
    contrastColor(color, palette.surface, 3),
    palette.track,
    3,
  );
}
