import {
  cardPaletteIds,
  cardTypes,
  type CardPaletteId,
  type CardType,
  type CardWidth,
  type DashboardCard,
  type DashboardLayout,
} from "../../domain/types";
import { catalog } from "./catalog";

const defaults: [CardType, CardWidth][] = [
  ["balance", 8],
  ["available", 4],
  ["envelopes", 6],
  ["upcoming", 6],
  ["week", 4],
  ["spending", 4],
  ["inbox", 4],
  ["recent", 8],
  ["accounts", 4],
];

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `card-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export function createCard(type: CardType, width?: CardWidth): DashboardCard {
  const definition = catalog[type];
  return {
    id: newId(),
    type,
    width:
      width && definition.widths.includes(width)
        ? width
        : definition.defaultWidth,
    palette: definition.defaultPalette,
  };
}

export const defaultLayout = (): DashboardLayout => ({
  version: 2,
  cards: defaults.map(([type, width]) => createCard(type, width)),
});

const isType = (value: unknown): value is CardType =>
  cardTypes.includes(value as CardType);
const isPalette = (value: unknown): value is CardPaletteId =>
  cardPaletteIds.includes(value as CardPaletteId);

/** Nearest allowed width, the default on a tie or a non-number. */
function fitWidth(type: CardType, width: unknown): CardWidth {
  const { widths, defaultWidth } = catalog[type];
  if (typeof width !== "number" || !Number.isFinite(width)) return defaultWidth;
  if (widths.includes(width as CardWidth)) return width as CardWidth;
  return widths.reduce((best, w) =>
    Math.abs(w - width) < Math.abs(best - width) ? w : best,
  );
}

function readOptions(value: unknown): DashboardCard["options"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const entries = Object.entries(value).filter(
    ([, v]) =>
      typeof v === "string" ||
      typeof v === "boolean" ||
      (typeof v === "number" && Number.isFinite(v)),
  );
  return entries.length
    ? (Object.fromEntries(entries) as DashboardCard["options"])
    : undefined;
}

/** Validated `prefs.dashboard`: unknown types dropped, widths fitted, ids unique. */
export function readLayout(stored: unknown): DashboardLayout {
  const raw = stored as { version?: unknown; cards?: unknown } | undefined;
  if (!raw || raw.version !== 2 || !Array.isArray(raw.cards))
    return defaultLayout();
  const seen = new Set<string>();
  const cards: DashboardCard[] = [];
  for (const item of raw.cards as Record<string, unknown>[]) {
    if (!item || typeof item !== "object" || !isType(item.type)) continue;
    const id =
      typeof item.id === "string" && item.id && !seen.has(item.id)
        ? item.id
        : newId();
    seen.add(id);
    const card: DashboardCard = {
      id,
      type: item.type,
      width: fitWidth(item.type, item.width),
      palette: isPalette(item.palette)
        ? item.palette
        : catalog[item.type].defaultPalette,
    };
    if (
      typeof item.account === "string" &&
      item.account &&
      catalog[item.type].supportsAccount
    )
      card.account = item.account;
    const options = readOptions(item.options);
    if (options) card.options = options;
    cards.push(card);
  }
  return { version: 2, cards };
}

export type Breakpoint = "desktop" | "tablet";

/** Width a card takes on tablets: quarters and thirds become halves, two thirds full. */
const onTablet = (width: CardWidth) => (width <= 6 ? 6 : 12);

/**
 * Column spans after filling rows. When the next card does not fit, the free
 * columns of the row go to its cards, last first, each up to its widest allowed
 * width (any width on tablets), so rows end flush instead of leaving holes.
 */
export function rowSpans(
  cards: readonly Pick<DashboardCard, "type" | "width">[],
  breakpoint: Breakpoint,
): number[] {
  const spans = cards.map((c) =>
    breakpoint === "tablet" ? onTablet(c.width) : c.width,
  );
  const max = cards.map((c) =>
    breakpoint === "tablet" ? 12 : Math.max(...catalog[c.type].widths),
  );
  const fill = (from: number, to: number) => {
    let free = 12 - spans.slice(from, to).reduce((a, b) => a + b, 0);
    for (let i = to - 1; i >= from && free > 0; i--) {
      const extra = Math.min(free, max[i] - spans[i]);
      spans[i] += extra;
      free -= extra;
    }
  };
  let start = 0;
  let used = 0;
  spans.forEach((span, i) => {
    if (used + span > 12) {
      fill(start, i);
      start = i;
      used = 0;
    }
    used += span;
  });
  fill(start, spans.length);
  return spans;
}
