import {
  widgetNames,
  type Preferences,
  type WidgetId,
  type WidgetSize,
} from "./types";
import { defaultSize, sizesFor } from "./intelligence";
import { isCardPaletteId, type CardPaletteId } from "./cardPalettes";
import {
  visualizationIds,
  type VisualizationId,
} from "./visualizationRegistry";

export type BoardTone = CardPaletteId;
export type BoardBreakpoint = "laptop" | "desktop" | "wide";
export interface BoardInstance {
  id: string;
  type: WidgetId;
  size: WidgetSize;
  tone: BoardTone;
  source: { kind: "global" | "household" | "account"; account?: string };
  period: { kind: "global" } | { kind: "months"; months: 1 | 3 | 6 | 12 };
  representation: "default" | VisualizationId;
  options?: Partial<
    Pick<Preferences, "budgetOrder" | "budgetLimit" | "budgetView">
  >;
}
export interface BoardPosition {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW: number;
  minH: number;
  maxW: number;
  maxH: number;
}
export interface BoardView {
  id: string;
  name: string;
  instances: BoardInstance[];
  layouts: Record<BoardBreakpoint, BoardPosition[]>;
  mobileOrder: string[];
}
export interface BoardState {
  version: 1;
  geometryVersion?: 2;
  revision: number;
  activeView: string;
  views: BoardView[];
  legacy: {
    widgets: WidgetId[];
    sizes: Preferences["sizes"];
    tones: Preferences["tones"];
  };
}
export const boardBreakpoints: BoardBreakpoint[] = [
  "laptop",
  "desktop",
  "wide",
];
export const freeColumns = 24;
export const boardRowHeight = 12;
export function boardBreakpoint(width: number): BoardBreakpoint {
  return width >= 2600 ? "wide" : width >= 1700 ? "desktop" : "laptop";
}
export const defaultTone = (type: WidgetId): BoardTone =>
  type === "available"
    ? "ink"
    : type === "goal"
      ? "pink"
      : type === "dues"
        ? "cyan"
        : type === "categories"
          ? "yellow"
          : "paper";
export function makeInstance(
  type: WidgetId,
  id: string = crypto.randomUUID(),
): BoardInstance {
  return {
    id,
    type,
    size: defaultSize(type),
    tone: defaultTone(type),
    source: { kind: "global" },
    period: { kind: "global" },
    representation: "default",
  };
}
export function dimensions(
  instance: BoardInstance,
  breakpoint: BoardBreakpoint,
): Pick<BoardPosition, "w" | "h" | "minW" | "minH" | "maxW" | "maxH"> {
  const width = { tiny: 6, small: 8, medium: 12, large: 16, xlarge: 24 }[
    instance.size
  ];
  const heights = { tiny: 14, small: 22, medium: 28, large: 36, xlarge: 44 };
  return {
    w:
      breakpoint === "laptop"
        ? width
        : Math.max(
            4,
            Math.round(width * (breakpoint === "wide" ? 2 / 3 : 3 / 4)),
          ),
    h: heights[instance.size],
    minW: 4,
    minH: 12,
    maxW: 24,
    maxH: 240,
  };
}
/** Compact vertically while retaining each chosen column and footprint.
 * A moved card takes the place of the first card it intersects; neighbours
 * settle below it. Empty vertical space is no longer a persisted intention. */
export function settleLayout(
  layout: BoardPosition[],
  anchor?: string,
): BoardPosition[] {
  const placed: BoardPosition[] = [];
  const ordered = layout
    .filter((p) => p.i !== anchor)
    .sort((a, b) => a.y - b.y || a.x - b.x || a.i.localeCompare(b.i));
  const moved = layout.find((p) => p.i === anchor);
  if (moved) {
    const hit = ordered.findIndex((p) => overlaps(moved, p));
    const after = ordered.findIndex(
      (p) => p.y > moved.y || (p.y === moved.y && p.x >= moved.x),
    );
    const index = hit >= 0 ? hit : after >= 0 ? after : ordered.length;
    ordered.splice(index, 0, moved);
  }
  for (const original of ordered) {
    const next = { ...original, y: 0 };
    let collisions = placed.filter((p) => overlaps(next, p));
    while (collisions.length) {
      next.y = Math.max(...collisions.map((p) => p.y + p.h + 2));
      collisions = placed.filter((p) => overlaps(next, p));
    }
    placed.push(next);
  }
  return layout.map((p) => placed.find((next) => next.i === p.i)!);
}

/** In a compact grid a one-row vertical nudge immediately settles back.
 * Keyboard Up/Down therefore crosses the nearest card sharing its columns. */
export function verticalNeighbourPosition(
  layout: BoardPosition[],
  id: string,
  direction: -1 | 1,
): { x: number; y: number } | null {
  const current = layout.find((p) => p.i === id);
  if (!current) return null;
  const neighbour = layout
    .filter(
      (p) =>
        p.i !== id &&
        p.x < current.x + current.w &&
        p.x + p.w > current.x &&
        (direction > 0 ? p.y > current.y : p.y < current.y),
    )
    .sort((a, b) => direction * (a.y - b.y) || a.x - b.x)[0];
  return neighbour
    ? {
        x: current.x,
        y: direction > 0 ? neighbour.y + neighbour.h + 2 : neighbour.y,
      }
    : null;
}

/** Content is measured independently of its grid item. Never reuse an old
 * measured/grid height as a minimum: a collapsed table must release its rows. */
export function fitContentLayout(
  view: BoardView,
  breakpoint: BoardBreakpoint,
  heights: Record<string, number>,
): BoardPosition[] {
  return settleLayout(
    view.layouts[breakpoint].map((p) => {
      const instance = view.instances.find((i) => i.id === p.i)!;
      return {
        ...p,
        h: Math.max(
          Math.min(
            p.maxH,
            Math.max(p.minH, dimensions(instance, breakpoint).h),
          ),
          Math.ceil((heights[p.i] ?? 0) / boardRowHeight),
        ),
      };
    }),
  );
}

/** Read-time geometry projection. Old boards keep their IDs, columns, widths,
 * settings and source data. The original backup is not rewritten on open. */
export function compactBoard(board: BoardState): BoardState {
  return {
    ...board,
    views: board.views.map((view) => ({
      ...view,
      layouts: Object.fromEntries(
        boardBreakpoints.map((breakpoint) => [
          breakpoint,
          settleLayout(
            view.layouts[breakpoint].map((p) => ({
              ...p,
              h: Math.min(
                p.maxH,
                Math.max(
                  p.minH,
                  dimensions(
                    view.instances.find((i) => i.id === p.i)!,
                    breakpoint,
                  ).h,
                ),
              ),
            })),
          ),
        ]),
      ) as BoardView["layouts"],
    })),
  };
}
export function overlaps(a: BoardPosition, b: BoardPosition) {
  return (
    a.i !== b.i &&
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}
export function validPosition(p: BoardPosition) {
  return (
    [p.x, p.y, p.w, p.h, p.minW, p.minH, p.maxW, p.maxH].every(
      Number.isInteger,
    ) &&
    p.x >= 0 &&
    p.y >= 0 &&
    p.y <= 20000 &&
    p.minW >= 1 &&
    p.minH >= 1 &&
    p.maxW <= 24 &&
    p.maxH <= 240 &&
    p.w >= p.minW &&
    p.w <= p.maxW &&
    p.h >= p.minH &&
    p.h <= p.maxH &&
    p.x + p.w <= 24
  );
}
export function positionChange(
  layout: BoardPosition[],
  id: string,
  change: Partial<Pick<BoardPosition, "x" | "y" | "w" | "h">>,
): BoardPosition[] | null {
  const previous = layout.find((p) => p.i === id);
  if (!previous) return null;
  const candidate = { ...previous, ...change };
  if (!validPosition(candidate)) return null;
  const next = settleLayout(
    layout.map((p) => (p.i === id ? candidate : p)),
    id,
  );
  return next.every(validPosition) ? next : null;
}
export function resizeInstance(
  view: BoardView,
  id: string,
  size: WidgetSize,
): BoardView {
  const instance = view.instances.find((i) => i.id === id);
  if (!instance || !sizesFor(instance.type).includes(size)) return view;
  const updated = { ...instance, size };
  const layouts = { ...view.layouts };
  for (const key of boardBreakpoints) {
    layouts[key] = settleLayout(
      layouts[key].map((p) => {
        if (p.i !== id) return p;
        const box = dimensions(updated, key);
        return { ...p, ...box, x: Math.min(p.x, freeColumns - box.w) };
      }),
      id,
    );
  }
  return {
    ...view,
    layouts,
    instances: view.instances.map((i) => (i.id === id ? updated : i)),
  };
}
/** Non-destructive upgrade of old independent detail/geometry settings. The
 * original persisted board is untouched until the user saves their layout. */
export function upgradeGeometry(board: BoardState): BoardState {
  if (board.geometryVersion === 2) return board;
  return {
    ...board,
    geometryVersion: 2,
    views: board.views.map((view) => {
      const layouts = { ...view.layouts };
      for (const key of boardBreakpoints) {
        layouts[key] = settleLayout(
          layouts[key].map((p) => {
            const box = dimensions(
              view.instances.find((i) => i.id === p.i)!,
              key,
            );
            return { ...p, ...box, x: Math.min(p.x, freeColumns - box.w) };
          }),
        );
      }
      return { ...view, layouts };
    }),
  };
}
/** New cards join the compact layout without changing existing data. */
export function appendPosition(
  layout: BoardPosition[],
  instance: BoardInstance,
  breakpoint: BoardBreakpoint,
): BoardPosition[] {
  const box = dimensions(instance, breakpoint);
  const y = layout.length ? Math.max(...layout.map((p) => p.y + p.h)) + 2 : 0;
  return settleLayout([...layout, { i: instance.id, x: 0, y, ...box }]);
}
export function initialLayout(
  instances: BoardInstance[],
  breakpoint: BoardBreakpoint,
) {
  const result: BoardPosition[] = [];
  let x = 0,
    y = 0,
    rowBottom = 0;
  for (const instance of instances) {
    const size = dimensions(instance, breakpoint);
    if (x + size.w > 24) {
      x = 0;
      y = rowBottom + 2;
    }
    result.push({ i: instance.id, x, y, ...size });
    x += size.w;
    rowBottom = Math.max(rowBottom, y + size.h);
  }
  return settleLayout(result);
}
export function migrateBoard(
  p: Pick<Preferences, "widgets" | "sizes" | "tones">,
): BoardState {
  const instances = p.widgets.map((type) => ({
    ...makeInstance(type, `legacy-${type}`),
    size: p.sizes?.[type] ?? defaultSize(type),
    tone: p.tones?.[type] ?? defaultTone(type),
  }));
  const view: BoardView = {
    id: "main",
    name: "Mon dashboard",
    instances,
    mobileOrder: instances.map((i) => i.id),
    layouts: {
      laptop: initialLayout(instances, "laptop"),
      desktop: initialLayout(instances, "desktop"),
      wide: initialLayout(instances, "wide"),
    },
  };
  return {
    version: 1,
    geometryVersion: 2,
    revision: 0,
    activeView: view.id,
    views: [view],
    legacy: structuredClone({
      widgets: p.widgets,
      sizes: p.sizes,
      tones: p.tones,
    }),
  };
}
export function readingOrder(view: BoardView, breakpoint: BoardBreakpoint) {
  return [...view.layouts[breakpoint]]
    .sort((a, b) => a.y - b.y || a.x - b.x || a.i.localeCompare(b.i))
    .map((p) => p.i);
}
export function addInstance(
  view: BoardView,
  instance: BoardInstance,
): BoardView {
  return {
    ...view,
    instances: [...view.instances, instance],
    mobileOrder: [...view.mobileOrder, instance.id],
    layouts: {
      laptop: appendPosition(view.layouts.laptop, instance, "laptop"),
      desktop: appendPosition(view.layouts.desktop, instance, "desktop"),
      wide: appendPosition(view.layouts.wide, instance, "wide"),
    },
  };
}
export function removeInstance(view: BoardView, id: string): BoardView {
  return {
    ...view,
    instances: view.instances.filter((i) => i.id !== id),
    mobileOrder: view.mobileOrder.filter((i) => i !== id),
    layouts: {
      laptop: settleLayout(view.layouts.laptop.filter((p) => p.i !== id)),
      desktop: settleLayout(view.layouts.desktop.filter((p) => p.i !== id)),
      wide: settleLayout(view.layouts.wide.filter((p) => p.i !== id)),
    },
  };
}
export function duplicateView(view: BoardView, name: string): BoardView {
  const ids = new Map(view.instances.map((i) => [i.id, crypto.randomUUID()]));
  const result = structuredClone(view);
  result.id = crypto.randomUUID();
  result.name = name;
  result.instances = result.instances.map((i) => ({
    ...i,
    id: ids.get(i.id)!,
  }));
  result.mobileOrder = result.mobileOrder.map((id) => ids.get(id)!);
  for (const key of boardBreakpoints)
    result.layouts[key] = result.layouts[key].map((p) => ({
      ...p,
      i: ids.get(p.i)!,
    }));
  return result;
}
export function validateBoardState(value: unknown): value is BoardState {
  try {
    const b = value as BoardState;
    if (
      !b ||
      b.version !== 1 ||
      !Number.isSafeInteger(b.revision) ||
      b.revision < 0 ||
      !Array.isArray(b.views) ||
      !b.views.length ||
      b.views.length > 50 ||
      !b.legacy ||
      !Array.isArray(b.legacy.widgets) ||
      b.legacy.widgets.some((type) => !Object.hasOwn(widgetNames, type)) ||
      new Set(b.legacy.widgets).size !== b.legacy.widgets.length ||
      (b.legacy.sizes &&
        (typeof b.legacy.sizes !== "object" ||
          Array.isArray(b.legacy.sizes) ||
          Object.entries(b.legacy.sizes).some(
            ([type, size]) =>
              !Object.hasOwn(widgetNames, type) ||
              !sizesFor(type as WidgetId).includes(size),
          ))) ||
      (b.legacy.tones &&
        (typeof b.legacy.tones !== "object" ||
          Array.isArray(b.legacy.tones) ||
          Object.entries(b.legacy.tones).some(
            ([type, tone]) =>
              !Object.hasOwn(widgetNames, type) || !isCardPaletteId(tone),
          )))
    )
      return false;
    const viewIds = new Set<string>();
    const allInstanceIds = new Set<string>();
    for (const v of b.views) {
      if (
        !v ||
        typeof v.id !== "string" ||
        !v.id ||
        viewIds.has(v.id) ||
        typeof v.name !== "string" ||
        !v.name.trim() ||
        v.name.length > 80 ||
        !Array.isArray(v.instances) ||
        v.instances.length > 100 ||
        !Array.isArray(v.mobileOrder)
      )
        return false;
      viewIds.add(v.id);
      const ids = new Set<string>();
      for (const i of v.instances) {
        if (
          !i ||
          typeof i.id !== "string" ||
          !i.id ||
          allInstanceIds.has(i.id) ||
          !Object.hasOwn(widgetNames, i.type) ||
          !sizesFor(i.type).includes(i.size) ||
          !isCardPaletteId(i.tone) ||
          !["default", ...visualizationIds].includes(i.representation) ||
          !["global", "household", "account"].includes(i.source?.kind) ||
          (i.source.kind === "account" &&
            (typeof i.source.account !== "string" || !i.source.account)) ||
          !["global", "months"].includes(i.period?.kind) ||
          (i.period.kind === "months" &&
            ![1, 3, 6, 12].includes(i.period.months))
        )
          return false;
        ids.add(i.id);
        allInstanceIds.add(i.id);
        if (
          i.options &&
          (typeof i.options !== "object" ||
            Array.isArray(i.options) ||
            Object.keys(i.options).some(
              (key) =>
                !["budgetOrder", "budgetLimit", "budgetView"].includes(key),
            ))
        )
          return false;
        if (
          i.options &&
          ((i.options.budgetView !== undefined &&
            !["list", "rings"].includes(i.options.budgetView)) ||
            (i.options.budgetLimit !== undefined &&
              (!Number.isInteger(i.options.budgetLimit) ||
                i.options.budgetLimit < 0 ||
                i.options.budgetLimit > 1000)) ||
            (i.options.budgetOrder !== undefined &&
              (!Array.isArray(i.options.budgetOrder) ||
                i.options.budgetOrder.some((c) => typeof c !== "string") ||
                new Set(i.options.budgetOrder).size !==
                  i.options.budgetOrder.length)))
        )
          return false;
      }
      if (
        v.mobileOrder.length !== ids.size ||
        new Set(v.mobileOrder).size !== ids.size ||
        v.mobileOrder.some((id) => !ids.has(id))
      )
        return false;
      for (const key of boardBreakpoints) {
        const layout = v.layouts?.[key];
        if (
          !Array.isArray(layout) ||
          layout.length !== ids.size ||
          new Set(layout.map((p) => p.i)).size !== ids.size ||
          layout.some(
            (p) =>
              !ids.has(p.i) ||
              !validPosition(p) ||
              layout.some((other) => overlaps(p, other)),
          )
        )
          return false;
      }
    }
    return viewIds.has(b.activeView);
  } catch {
    return false;
  }
}
