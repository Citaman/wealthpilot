import type { WidgetId } from "./types";

export const visualizationIds = [
  "bars",
  "rings",
  "tiles",
  "stacked",
  "waffle",
  "bullet",
  "columns",
  "waterfall",
  "timeline",
  "line",
  "area",
] as const;
export type VisualizationId = (typeof visualizationIds)[number];
export const visualizationLabels: Record<VisualizationId, string> = {
  bars: "Lignes",
  rings: "Anneaux",
  tiles: "Tuiles",
  stacked: "Répartition",
  waffle: "Mosaïque",
  bullet: "Cibles",
  columns: "Colonnes",
  waterfall: "Cascade",
  timeline: "Échéancier",
  line: "Courbe",
  area: "Aire",
};
const variants: Partial<Record<WidgetId, readonly VisualizationId[]>> = {
  chart: ["line", "area", "columns"],
  budgets: ["bars", "rings", "columns", "tiles"],
  balance: ["bars", "rings", "stacked", "tiles"],
  goals: ["bars", "rings", "tiles", "bullet"],
  savings: ["bars", "rings", "stacked", "waffle", "tiles"],
  categories: ["bars", "rings", "stacked", "waffle", "tiles"],
  effort: ["bars", "rings", "tiles", "bullet"],
  flows: ["bars", "columns", "waterfall"],
  comparison: ["bars", "tiles", "columns"],
  charges: ["bars", "timeline", "tiles"],
  recurring: ["bars", "columns", "tiles"],
  paidBy: ["bars", "stacked", "waffle"],
  unusual: ["bars", "tiles"],
  uncategorized: ["bars", "tiles"],
};
export function visualizationsFor(
  widget: WidgetId,
): readonly VisualizationId[] {
  return variants[widget] ?? ["bars"];
}
