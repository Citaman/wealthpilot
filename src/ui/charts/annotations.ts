import { MONO_CHAR } from "./scales";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AnnotationAnchor {
  id: string;
  x: number;
  y: number;
  label: string;
}

export interface PlacedAnnotation {
  id: string;
  text: string;
  box: Box;
  anchor: { x: number; y: number };
  side: "above" | "below";
  /** True when the box does not sit directly over its anchor. */
  connector: boolean;
}

export interface PlacementOptions {
  /** Plot area: boxes never leave it (so they never cover axis labels). */
  bounds: Box;
  /** Areas to keep clear, e.g. the threshold label. */
  obstacles?: Box[];
  maxWidth?: number;
  height?: number;
  gap?: number;
  padding?: number;
  char?: number;
}

export const overlaps = (a: Box, b: Box, margin = 2) =>
  a.x < b.x + b.width + margin &&
  b.x < a.x + a.width + margin &&
  a.y < b.y + b.height + margin &&
  b.y < a.y + a.height + margin;

/** Cuts `label` with an ellipsis so that it fits in `width` px of mono text. */
export function truncate(
  label: string,
  width: number,
  char = MONO_CHAR,
): string {
  const fits = Math.floor(width / char);
  if (label.length <= fits) return label;
  if (fits <= 1) return "…";
  return label.slice(0, fits - 1).trimEnd() + "…";
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

/**
 * Greedy collision-box placement, in the order given (most important first).
 * Each label tries above, below, then shifted and stacked positions; a label
 * that cannot fit anywhere is dropped rather than drawn over something else.
 */
export function placeAnnotations(
  anchors: readonly AnnotationAnchor[],
  {
    bounds,
    obstacles = [],
    maxWidth = 168,
    height = 22,
    gap = 10,
    padding = 8,
    char = MONO_CHAR,
  }: PlacementOptions,
): PlacedAnnotation[] {
  const placed: PlacedAnnotation[] = [];
  const points: Box[] = anchors.map((a) => ({
    x: a.x - 6,
    y: a.y - 6,
    width: 12,
    height: 12,
  }));
  const limit = Math.min(maxWidth, bounds.width);

  for (const [index, anchor] of anchors.entries()) {
    const others = points.filter((_, i) => i !== index);
    const blocked = (box: Box) =>
      box.y < bounds.y ||
      box.y + box.height > bounds.y + bounds.height ||
      obstacles.some((o) => overlaps(box, o)) ||
      others.some((p) => overlaps(box, p, 0)) ||
      placed.some((p) => overlaps(box, p.box));

    const candidates = function* () {
      for (const width of [limit, limit * 0.6]) {
        const text = truncate(anchor.label, width - 2 * padding, char);
        const w = Math.min(width, text.length * char + 2 * padding);
        const xs = [anchor.x - w / 2, anchor.x - w + 14, anchor.x - 14].map(
          (x) => clamp(x, bounds.x, bounds.x + bounds.width - w),
        );
        for (const level of [0, 1, 2])
          for (const side of ["above", "below"] as const) {
            const offset = gap + level * (height + 6);
            const y =
              side === "above" ? anchor.y - offset - height : anchor.y + offset;
            for (const x of xs)
              yield { text, side, level, box: { x, y, width: w, height } };
          }
      }
    };
    let result: PlacedAnnotation | null = null;
    for (const { text, side, level, box } of candidates()) {
      if (blocked(box)) continue;
      const over = anchor.x >= box.x + 4 && anchor.x <= box.x + box.width - 4;
      result = {
        id: anchor.id,
        text,
        box,
        anchor: { x: anchor.x, y: anchor.y },
        side,
        connector: level > 0 || !over,
      };
      break;
    }
    if (result) placed.push(result);
  }
  return placed;
}
