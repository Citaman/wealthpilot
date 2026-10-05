import {
  useCallback,
  useEffect,
  useLayoutEffect,
  memo,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import { flushSync } from "react-dom";
import {
  GridLayout,
  noCompactor,
  type Layout,
  type GridLayoutProps,
} from "react-grid-layout";
import {
  GripVertical,
  Minus,
  Plus,
  Check,
  X,
  SlidersHorizontal,
  Copy,
} from "lucide-react";
import {
  defaultPreferences,
  widgetNames,
  type Snapshot,
  type WidgetId,
  type WidgetSize,
} from "./types";
import { defaultSize, sizesFor } from "./intelligence";
import { db } from "./store";
import { normalize } from "./search";
import { Select } from "./Select";
import { PageActions } from "./PageActions";
import { BoardInstanceContext } from "./BoardInstanceContext";
import { contractFor } from "./widgetContracts";
import { activeBoard, activeWidgetIds } from "./productScope";
import {
  cardPaletteIds,
  cardPalettes,
  cardPaletteClassName,
  cardPaletteStyle,
} from "./cardPalettes";
import {
  addInstance,
  boardBreakpoint,
  boardRowHeight,
  defaultTone,
  duplicateView,
  makeInstance,
  migrateBoard,
  positionChange,
  fitContentLayout,
  compactBoard,
  verticalNeighbourPosition,
  dimensions,
  resizeInstance,
  upgradeGeometry,
  readingOrder,
  removeInstance,
  validateBoardState,
  type BoardInstance,
  type BoardPosition,
  type BoardState,
  type BoardTone,
  type BoardView,
} from "./layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "./board.css";
import "./card-palettes.css";

// RGL provides pointer/grid snapping; our deterministic compacting function
// owns neighbour placement, shared by keyboard, pointer and content resizing.
const compactBoardEngine = {
  ...noCompactor,
  allowOverlap: true,
  preventCollision: false,
};
type EventCallback = NonNullable<GridLayoutProps["onDragStop"]>;
const sizeLabels = {
  tiny: "Mini",
  small: "Petit",
  medium: "Moyen",
  large: "Grand",
  xlarge: "Très grand",
};
const recommendedFamilies: WidgetId[] = [
  "balance",
  "available",
  "chart",
  "flows",
  "budgets",
  "purchase",
  "dues",
  "safety",
  "funding",
  "paidBy",
  "transactions",
  "recurring",
  "categories",
  "pace",
  "comparison",
  "sources",
];
const familyNotes: Partial<Record<WidgetId, string>> = {
  balance: "Comptes et solde du foyer · regroupe la répartition des comptes",
  available: "Marge du foyer · horizon mensuel et réserves",
  chart: "Trajectoire et risques · solde, point bas et prévision",
  transactions: "Journal · derniers mouvements et accès aux files de revue",
  dues: "Échéances · charges et revenus à venir",
  purchase: "Simulations · achat ponctuel sans écriture bancaire",
};
function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <Select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </label>
  );
}
export function DashboardBoard({
  snapshot,
  editing,
  onFinish,
  notify,
  children,
  openCatalog = false,
}: {
  snapshot: Snapshot;
  editing: boolean;
  onFinish: () => void;
  notify: (s: string) => void;
  openCatalog?: boolean;
  children: (
    id: WidgetId,
    size: WidgetSize,
    instance?: BoardInstance,
  ) => ReactNode;
}) {
  const persisted = useMemo(
    () =>
      compactBoard(
        activeBoard(
          upgradeGeometry(
            snapshot.preferences.board ?? migrateBoard(snapshot.preferences),
          ),
        ),
      ),
    [snapshot.preferences],
  );
  const [draft, setDraft] = useState<BoardState>(persisted);
  const [adding, setAdding] = useState(false),
    [query, setQuery] = useState(""),
    [busy, setBusy] = useState(false);
  const [allCatalog, setAllCatalog] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null),
    [focusTarget, setFocusTarget] = useState<string | null>(null);
  const [resetGesture, setResetGesture] = useState(false);
  const [previewLayout, setPreviewLayout] = useState<BoardPosition[] | null>(
    null,
  );
  const [message, setMessage] = useState(""),
    [restore, setRestore] = useState(false),
    [width, setWidth] = useState(1280),
    [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const container = useRef<HTMLDivElement>(null),
    controls = useRef(new Map<string, HTMLButtonElement>()),
    addButton = useRef<HTMLButtonElement>(null);
  const starting = useRef<BoardState>(persisted),
    gesture = useRef<{
      layout: BoardPosition[];
      cancelled: boolean;
      item: BoardPosition;
    } | null>(null);
  const liveCompactor = useMemo(
    () => ({
      ...compactBoardEngine,
      compact: (positions: Layout) => {
        const current = gesture.current;
        if (!current) return positions;
        if (current.cancelled) return current.layout;
        const item = positions.find((p) => p.i === current.item.i);
        if (!item) return positions;
        return (
          positionChange(current.layout, item.i, {
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
          }) ?? current.layout
        );
      },
    }),
    [],
  );
  useEffect(() => {
    const cancelGesture = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !gesture.current) return;
      event.preventDefault();
      event.stopPropagation();
      gesture.current.cancelled = true;
      setPreviewLayout(null);
      setPlacing(false);
      setMessage("Geste annulé ; relâchez la carte.");
    };
    // Safari does not focus a button on pointer-down; cancellation cannot rely
    // on the drag handle being the keyboard event's ancestor.
    window.addEventListener("keydown", cancelGesture, true);
    return () => window.removeEventListener("keydown", cancelGesture, true);
  }, []);
  const state = editing ? draft : persisted;
  const [contentHeights, setContentHeights] = useState<Record<string, number>>(
    {},
  );
  const measureContent = useCallback((id: string, height: number) => {
    setContentHeights((previous) =>
      previous[id] === height ? previous : { ...previous, [id]: height },
    );
  }, []);
  const view =
    state.views.find((v) => v.id === state.activeView) ?? state.views[0];
  const breakpoint = boardBreakpoint(width),
    mobile = width < 760,
    baseline = view.layouts[breakpoint];
  const fittedLayout = useMemo(
    () => fitContentLayout(view, breakpoint, contentHeights),
    [view, breakpoint, contentHeights],
  );
  const layout = previewLayout ?? fittedLayout;
  const active = view.instances.find((i) => i.id === activeId),
    activePosition = layout.find((p) => p.i === activeId);
  const order = mobile
    ? view.mobileOrder
    : readingOrder(
        { ...view, layouts: { ...view.layouts, [breakpoint]: fittedLayout } },
        breakpoint,
      );
  const tileNodes = useRef(new Map<string, HTMLDivElement>());
  useEffect(() => {
    if (!container.current) return;
    let previousWidth = 0;
    let settle: ReturnType<typeof setTimeout> | undefined;
    const measure = () => {
      const element = container.current;
      const w = element?.getBoundingClientRect().width;
      if (w && element && w !== previousWidth) {
        previousWidth = w;
        // Different breakpoint layouts must switch atomically, not tween through neighbours.
        element.dataset.layoutResize = "true";
        clearTimeout(settle);
        setWidth(w);
        settle = setTimeout(() => delete element.dataset.layoutResize, 300);
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      clearTimeout(settle);
    };
  }, []);
  // Cached pages remain mounted while hidden. On re-entry, ResizeObserver can
  // report the new width only after paint; measure the now-visible container
  // synchronously so a desktop footprint never flashes on a narrow viewport.
  useLayoutEffect(() => {
    const element = container.current;
    const measured = element?.getBoundingClientRect().width;
    if (element && measured && measured !== width) {
      element.dataset.layoutResize = "true";
      setWidth(measured);
    }
  });
  useEffect(() => {
    if (editing) {
      setDraft(structuredClone(persisted));
      starting.current = structuredClone(persisted);
      setActiveId(null);
      setFocusTarget("add");
      setMessage("");
      setError("");
      if (openCatalog) setAdding(true);
    } else {
      setAdding(false);
      setPlacing(false);
      setRestore(false);
    }
  }, [editing, openCatalog]);
  useEffect(() => {
    if (!focusTarget) return;
    const frame = requestAnimationFrame(() => {
      (focusTarget === "add"
        ? addButton.current
        : controls.current.get(focusTarget)
      )?.focus();
      setFocusTarget(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [focusTarget]);
  const replaceView = (next: BoardView) =>
    setDraft((previous) => ({
      ...previous,
      views: previous.views.map((v) => (v.id === next.id ? next : v)),
    }));
  function updateInstance(change: Partial<BoardInstance>) {
    if (active) {
      const next = change.size
        ? resizeInstance(view, active.id, change.size)
        : view;
      replaceView({
        ...next,
        instances: next.instances.map((i) =>
          i.id === active.id ? { ...i, ...change } : i,
        ),
      });
    }
  }
  async function updateCard(id: string, change: Partial<BoardInstance>) {
    const updatedView = {
      ...view,
      instances: view.instances.map((i) =>
        i.id === id ? { ...i, ...change, id: i.id, type: i.type } : i,
      ),
    };
    if (editing) {
      replaceView(updatedView);
      return;
    }
    try {
      await db.transaction("rw", db.preferences, async () => {
        const latest = await db.preferences.get("main");
        if (!latest)
          throw new Error(
            "Importez ou enregistrez votre première disposition avant ce réglage.",
          );
        const current = upgradeGeometry(latest.board ?? migrateBoard(latest));
        const currentView = current.views.find((v) => v.id === view.id);
        const currentInstance = currentView?.instances.find((i) => i.id === id);
        const originalInstance = view.instances.find((i) => i.id === id);
        if (!currentView || !currentInstance || !originalInstance)
          throw new Error(
            "Cette carte a été retirée. Votre réglage n’a pas été enregistré.",
          );
        // Compare only edited fields: changing a different card (or another
        // property of this card) is not a conflict and must not be overwritten.
        for (const key of Object.keys(change) as (keyof BoardInstance)[]) {
          const before = originalInstance[key],
            latestValue = currentInstance[key];
          if (key === "options") {
            for (const option of Object.keys(
              change.options ?? {},
            ) as (keyof NonNullable<BoardInstance["options"]>)[])
              if (
                JSON.stringify(originalInstance.options?.[option]) !==
                  JSON.stringify(currentInstance.options?.[option]) &&
                JSON.stringify(change.options?.[option]) !==
                  JSON.stringify(currentInstance.options?.[option])
              )
                throw new Error(
                  "Ce réglage a changé dans un autre onglet. Réessayez sur la version actualisée.",
                );
          } else if (
            JSON.stringify(before) !== JSON.stringify(latestValue) &&
            JSON.stringify(change[key]) !== JSON.stringify(latestValue)
          )
            throw new Error(
              "Ce réglage a changé dans un autre onglet. Réessayez sur la version actualisée.",
            );
        }
        const merged = {
          ...currentInstance,
          ...change,
          id,
          type: currentInstance.type,
          ...(change.options
            ? { options: { ...currentInstance.options, ...change.options } }
            : {}),
        };
        const next = {
          ...current,
          revision: current.revision + 1,
          views: current.views.map((v) =>
            v.id === currentView.id
              ? {
                  ...v,
                  instances: v.instances.map((i) => (i.id === id ? merged : i)),
                }
              : v,
          ),
        };
        if (!validateBoardState(next))
          throw new Error("Réglage invalide : rien n’a été enregistré.");
        await db.preferences.put({ ...latest, board: next });
      });
    } catch (error) {
      notify((error as Error).message);
      throw error;
    }
  }
  const updateLatest = useRef(updateCard);
  updateLatest.current = updateCard;
  const changeCard = useCallback(
    (id: string, change: Partial<BoardInstance>) =>
      updateLatest.current(id, change),
    [],
  );
  function place(
    id: string,
    change: Partial<Pick<BoardPosition, "x" | "y" | "w" | "h">>,
  ) {
    const next = positionChange(layout, id, change);
    if (!next) {
      setMessage("Cette position dépasse les limites du dashboard.");
      return false;
    }
    // Measured content and the temporary editor must never become a saved
    // minimum height. Store geometry intent; derive content fit on each render.
    const stored = next.map((p) => ({
      ...p,
      h: baseline.find((b) => b.i === p.i)!.h,
    }));
    replaceView({
      ...view,
      layouts: { ...view.layouts, [breakpoint]: stored },
    });
    setMessage(
      "Position ajustée sur la grille. Les voisines se réorganisent et les espaces verticaux se referment.",
    );
    return true;
  }
  function remove(id: string) {
    const index = order.indexOf(id),
      nextView = removeInstance(view, id),
      nextId =
        order.filter((other) => other !== id)[Math.max(0, index - 1)] ?? null;
    replaceView(nextView);
    setActiveId(nextId);
    setFocusTarget(nextId ?? "add");
  }
  function add(type: WidgetId) {
    const instance = makeInstance(type);
    replaceView(addInstance(view, instance));
    setAdding(false);
    setActiveId(instance.id);
    setFocusTarget(instance.id);
    requestAnimationFrame(() =>
      tileNodes.current
        .get(instance.id)
        ?.scrollIntoView?.({ block: "nearest" }),
    );
  }
  async function save() {
    if (!validateBoardState(draft)) {
      setError(
        "Disposition invalide : rien n’a été enregistré. Annulez pour retrouver la vue précédente.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      await db.transaction("rw", db.preferences, async () => {
        const latest = (await db.preferences.get("main")) ?? defaultPreferences;
        if ((latest.board?.revision ?? 0) !== starting.current.revision)
          throw new Error(
            "Cette disposition a changé dans un autre onglet. Votre brouillon est conservé ; annulez puis rouvrez Organiser pour charger la nouvelle version.",
          );
        const next = { ...draft, revision: starting.current.revision + 1 },
          chosen = next.views.find((v) => v.id === next.activeView)!;
        const spatial = readingOrder(chosen, breakpoint).map(
          (id) => chosen.instances.find((i) => i.id === id)!,
        );
        const unique = spatial.filter(
          (i, index) => spatial.findIndex((j) => j.type === i.type) === index,
        );
        await db.preferences.put({
          ...latest,
          board: next,
          widgets: unique.map((i) => i.type),
          sizes: Object.fromEntries(unique.map((i) => [i.type, i.size])),
          tones: Object.fromEntries(unique.map((i) => [i.type, i.tone])),
        });
      });
      onFinish();
      notify("Votre disposition est enregistrée.");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const startGesture: EventCallback = (_next, _old, item) => {
    if (!item) return;
    gesture.current = {
      layout: structuredClone(fittedLayout),
      cancelled: false,
      item: fittedLayout.find((p) => p.i === item.i)!,
    };
  };
  const trackGesture: EventCallback = (
    _next,
    _old,
    item,
    placeholder,
    event,
  ) => {
    const original = gesture.current;
    if (item && original && !original.cancelled) {
      const preview = positionChange(original.layout, item.i, {
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
      });
      if (preview) {
        setPreviewLayout(preview);
        const target = preview.find((p) => p.i === item.i)!;
        // RGL 2.2.2 sets activeDrag to this callback object after onDrag/onResize.
        // Show the *compacted* destination, not the raw pointer's empty row.
        if (placeholder)
          Object.assign(placeholder, {
            x: target.x,
            y: target.y,
            w: target.w,
            h: target.h,
          });
      }
    }
    const point =
      event instanceof MouseEvent
        ? event.clientY
        : (event as TouchEvent | undefined)?.touches?.[0]?.clientY;
    if (point !== undefined) {
      if (point > window.innerHeight - 72)
        window.scrollBy({ top: 24, behavior: "instant" });
      else if (point < 90) window.scrollBy({ top: -24, behavior: "instant" });
    }
  };
  const stopGesture: EventCallback = (_next, _old, item) => {
    if (!item || !gesture.current) return;
    const original = gesture.current;
    gesture.current = null;
    setPreviewLayout(null);
    if (original.cancelled) {
      // RGL keeps an internal drag state. Toggle harmless runtime metadata so
      // restoring equal external coordinates synchronizes without remounting children.
      setResetGesture((value) => !value);
      setMessage("Geste annulé.");
      return;
    }
    const changed = positionChange(original.layout, item.i, {
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
    });
    if (!changed) {
      setMessage("Collision : retour à la position précédente.");
      return;
    }
    // A handle changes the footprint and its content tier together.
    const instance = view.instances.find((i) => i.id === item.i)!;
    const resized = item.w !== original.item.w || item.h !== original.item.h;
    const size = resized
      ? [...sizesFor(instance.type)].sort((a, b) => {
          const score = (s: WidgetSize) => {
            const box = dimensions({ ...instance, size: s }, breakpoint);
            return Math.abs(box.w - item.w) * 3 + Math.abs(box.h - item.h) / 3;
          };
          return score(a) - score(b);
        })[0]
      : instance.size;
    const nextView = resized ? resizeInstance(view, instance.id, size) : view;
    const target = resized
      ? dimensions({ ...instance, size }, breakpoint)
      : baseline.find((p) => p.i === item.i)!;
    const nextLayout =
      positionChange(
        resized ? nextView.layouts[breakpoint] : original.layout,
        item.i,
        {
          x: Math.min(item.x, 24 - target.w),
          y: item.y,
          w: target.w,
          h: target.h,
        },
      ) ?? changed;
    const stored = nextLayout.map((p) => ({
      ...p,
      h: nextView.layouts[breakpoint].find((b) => b.i === p.i)!.h,
    }));
    replaceView({
      ...nextView,
      layouts: { ...nextView.layouts, [breakpoint]: stored },
    });
    setMessage("Carte positionnée sur la grille compacte.");
    setFocusTarget(item.i);
  };
  const catalog = activeWidgetIds.filter(
    (id) =>
      (allCatalog || recommendedFamilies.includes(id)) &&
      normalize(
        widgetNames[id] +
          " " +
          contractFor(id).question +
          " " +
          (familyNotes[id] ?? ""),
      ).includes(normalize(query)),
  );
  const inspector = editing && active && activePosition && (
    <section
      className="free-inspector"
      aria-label={`Réglages de ${widgetNames[active.type]}`}
      inert={busy || undefined}
    >
      <div className="detail-heading">
        <h3>{widgetNames[active.type]}</h3>
        <button
          className="icon-button"
          aria-label="Fermer les réglages"
          onClick={() => {
            setActiveId(null);
            setFocusTarget(active.id);
          }}
        >
          <X size={18} />
        </button>
      </div>
      <div className="free-inspector-row">
        <div role="group" aria-label={`Taille de ${widgetNames[active.type]}`}>
          <span>Taille et contenu</span>
          <div className="tile-sizes">
            {sizesFor(active.type).map((size) => (
              <button
                key={size}
                aria-label={`${sizeLabels[size]} — ${widgetNames[active.type]}`}
                aria-pressed={size === active.size}
                onClick={() => updateInstance({ size })}
              >
                <i className={`shape-${size}`} />
                <span>{sizeLabels[size]}</span>
              </button>
            ))}
          </div>
        </div>
        <div
          className="tile-colors"
          role="group"
          aria-label={`Couleur de ${widgetNames[active.type]}`}
        >
          {cardPaletteIds.map((tone) => (
            <button
              key={tone}
              className={`swatch ${cardPaletteClassName(tone)}`}
              style={cardPaletteStyle(tone)}
              aria-label={`${cardPalettes[tone].label} — ${widgetNames[active.type]}`}
              aria-pressed={tone === active.tone}
              onClick={() => updateInstance({ tone })}
            />
          ))}
        </div>
      </div>
      <p className="card-contract-question">
        {contractFor(active.type).question}
      </p>
      <div className="free-inspector-row">
        {contractFor(active.type).scope === "account" ? (
          <Choice
            label="Source de cette carte"
            value={
              active.source.kind === "account"
                ? `account:${active.source.account}`
                : active.source.kind
            }
            options={[
              { value: "global", label: "Suivre le filtre global" },
              { value: "household", label: "Tout le foyer" },
              ...snapshot.accounts.map((a) => ({
                value: `account:${a.id}`,
                label: a.id,
              })),
            ]}
            onChange={(value) =>
              updateInstance({
                source: value.startsWith("account:")
                  ? { kind: "account", account: value.slice(8) }
                  : { kind: value as "global" | "household" },
              })
            }
          />
        ) : (
          <p>
            {contractFor(active.type).scope === "household"
              ? "Réglage commun au foyer : aucune répartition arbitraire par compte."
              : "Outil de configuration : indépendant des comptes."}
          </p>
        )}
        {contractFor(active.type).period === "range" ? (
          <Choice
            label="Période de cette carte"
            value={
              active.period.kind === "global"
                ? "global"
                : String(active.period.months)
            }
            options={[
              { value: "global", label: "Suivre la période globale" },
              ...[1, 3, 6, 12].map((n) => ({
                value: String(n),
                label: `${n} mois`,
              })),
            ]}
            onChange={(value) =>
              updateInstance({
                period:
                  value === "global"
                    ? { kind: "global" }
                    : {
                        kind: "months",
                        months: Number(value) as 1 | 3 | 6 | 12,
                      },
              })
            }
          />
        ) : (
          <p>
            {contractFor(active.type).period === "live"
              ? "Situation actuelle, indépendante de la période du dashboard."
              : contractFor(active.type).period === "cutoff"
                ? "Situation à la date de référence du mois sélectionné, pas un cumul de mois."
                : "Sans période financière."}
          </p>
        )}
      </div>
      {!mobile ? (
        <>
          <p>
            Placez la carte sur une case. Les voisines libèrent la place pendant
            le déplacement et remontent lorsqu’une carte rétrécit. Les colonnes
            choisies sont conservées ; les espaces verticaux se referment. La
            poignée latérale choisit une taille de contenu, pas une hauteur
            libre : la hauteur suit automatiquement le contenu.
          </p>
          <div className="free-coordinates">
            {(["x", "y"] as const).map((key) => (
              <label key={key}>
                {{ x: "Colonne", y: "Ligne", w: "Largeur", h: "Hauteur" }[key]}
                <input
                  type="number"
                  aria-label={`${{ x: "Colonne", y: "Ligne", w: "Largeur", h: "Hauteur" }[key]} de la carte`}
                  value={activePosition[key]}
                  min={0}
                  max={key === "x" ? 24 - activePosition.w : 20000}
                  onChange={(e) =>
                    place(active.id, { [key]: Number(e.target.value) })
                  }
                />
              </label>
            ))}
          </div>
          <button
            className="button"
            aria-pressed={placing}
            onClick={() => setPlacing(!placing)}
          >
            {placing
              ? "Annuler le placement"
              : "Choisir un emplacement sans glisser"}
          </button>
          {placing && (
            <p>
              Cliquez une case de la grille ; Échap annule. Les cartes présentes
              se décalent pour lui faire de la place.
            </p>
          )}
        </>
      ) : (
        <p>
          Sur petit écran, l’ordre de lecture reste indépendant des positions
          ordinateur.
        </p>
      )}
      <div className="free-inspector-row">
        <button
          className="button"
          onClick={() => {
            const copy = {
              ...structuredClone(active),
              id: crypto.randomUUID(),
            };
            replaceView(addInstance(view, copy));
            setActiveId(copy.id);
            setFocusTarget(copy.id);
          }}
        >
          Dupliquer cette carte
        </button>
        {mobile && (
          <>
            <button
              className="button"
              onClick={() => {
                const list = [...view.mobileOrder],
                  at = list.indexOf(active.id);
                if (at > 0) {
                  [list[at - 1], list[at]] = [list[at], list[at - 1]];
                  replaceView({ ...view, mobileOrder: list });
                }
              }}
            >
              Monter dans l’ordre mobile
            </button>
            <button
              className="button"
              onClick={() => {
                const list = [...view.mobileOrder],
                  at = list.indexOf(active.id);
                if (at < list.length - 1) {
                  [list[at + 1], list[at]] = [list[at], list[at + 1]];
                  replaceView({ ...view, mobileOrder: list });
                }
              }}
            >
              Descendre dans l’ordre mobile
            </button>
          </>
        )}
      </div>
    </section>
  );
  function renderTile(instance: BoardInstance) {
    const p = layout.find((p) => p.i === instance.id)!;
    return (
      <div
        key={instance.id}
        ref={(node) => {
          if (node) tileNodes.current.set(instance.id, node);
          else tileNodes.current.delete(instance.id);
        }}
        data-widget={instance.type}
        data-instance={instance.id}
        className={`board-tile free-tile widget-size-${instance.size} ${cardPaletteClassName(instance.tone)}${activeId === instance.id && editing ? " tile-active" : ""}`}
        style={cardPaletteStyle(instance.tone)}
      >
        <MeasuredContent id={instance.id} onMeasure={measureContent}>
          {editing && (
            <div className="free-tile-tools">
              <button
                className="drag-handle"
                aria-label={`Déplacer ${widgetNames[instance.type]}`}
                title="Gauche/droite : une colonne. Haut/bas : avant/après la carte voisine. Maj + flèches : redimensionner."
                onKeyDown={(event) => {
                  const keys: Record<string, [number, number]> = {
                      ArrowLeft: [-1, 0],
                      ArrowRight: [1, 0],
                      ArrowUp: [0, -1],
                      ArrowDown: [0, 1],
                    },
                    delta = keys[event.key];
                  if (!delta || mobile) return;
                  event.preventDefault();
                  if (event.shiftKey) {
                    const sizes = sizesFor(instance.type),
                      index = sizes.indexOf(instance.size);
                    const size =
                      sizes[
                        Math.max(
                          0,
                          Math.min(
                            sizes.length - 1,
                            index + delta[0] + delta[1],
                          ),
                        )
                      ];
                    replaceView(resizeInstance(view, instance.id, size));
                  } else if (delta[1]) {
                    const target = verticalNeighbourPosition(
                      layout,
                      instance.id,
                      delta[1] as -1 | 1,
                    );
                    if (target) place(instance.id, target);
                    else
                      setMessage("La carte est déjà au bord de cette colonne.");
                  } else
                    place(instance.id, {
                      x: p.x + delta[0],
                      y: p.y + delta[1],
                    });
                }}
              >
                <GripVertical size={18} />
                <span>{widgetNames[instance.type]}</span>
              </button>
              <button
                ref={(node) => {
                  if (node) controls.current.set(instance.id, node);
                  else controls.current.delete(instance.id);
                }}
                className="icon-button"
                aria-label={`Personnaliser ${widgetNames[instance.type]}`}
                aria-expanded={activeId === instance.id}
                onClick={() => {
                  setActiveId(activeId === instance.id ? null : instance.id);
                  setPlacing(false);
                }}
              >
                <SlidersHorizontal size={17} />
              </button>
              <button
                className="icon-button"
                aria-label={`Retirer ${widgetNames[instance.type]}`}
                onClick={() => remove(instance.id)}
              >
                <Minus size={16} />
              </button>
            </div>
          )}
          <div
            className="free-tile-body"
            role="region"
            aria-label={widgetNames[instance.type]}
          >
            {activeId === instance.id && inspector}
            <div hidden={editing && activeId === instance.id}>
              <InstanceContent
                instance={instance}
                render={children}
                update={changeCard}
              />
            </div>
          </div>
        </MeasuredContent>
      </div>
    );
  }
  return (
    <div
      className="free-board-shell"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setPlacing(false);
          if (gesture.current) {
            gesture.current.cancelled = true;
            setPreviewLayout(null);
            setMessage("Geste annulé ; relâchez la carte.");
          }
        }
      }}
    >
      {editing && (
        <PageActions page="dashboard">
          <div
            className="dock-edit-actions"
            role="group"
            aria-label="Organiser le dashboard"
            aria-busy={busy}
          >
            <button
              ref={addButton}
              className="dock-action"
              aria-label="Ajouter une carte"
              disabled={busy}
              onClick={() => setAdding(!adding)}
              aria-expanded={adding}
            >
              <Plus size={17} />
              <span>Ajouter</span>
            </button>
            <button className="dock-action" disabled={busy} onClick={onFinish}>
              Annuler
            </button>
            <button
              className="dock-action dock-confirm"
              disabled={busy}
              onClick={save}
            >
              <Check size={16} />
              Terminer
            </button>
          </div>
        </PageActions>
      )}
      {editing && (
        <section
          className="free-view-controls"
          aria-label="Vues enregistrées"
          inert={busy || undefined}
        >
          <Choice
            label="Vue du dashboard"
            value={view.id}
            options={state.views.map((v) => ({ value: v.id, label: v.name }))}
            onChange={(id) => {
              setDraft({ ...draft, activeView: id });
              setActiveId(null);
            }}
          />
          <label>
            Nom de la vue
            <input
              maxLength={80}
              value={view.name}
              onChange={(e) => replaceView({ ...view, name: e.target.value })}
            />
          </label>
          <button
            className="button"
            onClick={() => {
              const copy = duplicateView(
                view,
                `${view.name.slice(0, 65)} — copie`,
              );
              setDraft({
                ...draft,
                views: [...draft.views, copy],
                activeView: copy.id,
              });
              setActiveId(null);
            }}
            disabled={state.views.length >= 50}
          >
            <Copy size={16} />
            Dupliquer la vue
          </button>
          <button
            className="text-button"
            onClick={() => setRestore(!restore)}
            aria-expanded={restore}
          >
            Restaurer la vue initiale
          </button>
          {restore && (
            <div className="free-restore">
              <p>
                Remplacer cette vue par les {state.legacy.widgets.length} cartes
                de l’ancienne disposition ? Vos autres vues et vos données
                financières restent intactes.
              </p>
              <button className="button" onClick={() => setRestore(false)}>
                Garder ma vue
              </button>
              <button
                className="button"
                onClick={() => {
                  const initial = duplicateView(
                    migrateBoard(state.legacy).views[0],
                    view.name,
                  );
                  replaceView({ ...initial, id: view.id, name: view.name });
                  setRestore(false);
                  setActiveId(null);
                }}
              >
                Confirmer la restauration
              </button>
            </div>
          )}
        </section>
      )}
      {editing && adding && (
        <section
          className="board-add"
          aria-label="Ajouter une carte"
          inert={busy || undefined}
        >
          <div className="detail-heading">
            <h2>Une place pour ce qui compte.</h2>
            <button
              className="icon-button"
              aria-label="Fermer le choix de cartes"
              onClick={() => {
                setAdding(false);
                setFocusTarget("add");
              }}
            >
              <X size={18} />
            </button>
          </div>
          <input
            type="search"
            autoFocus
            aria-label="Chercher une carte"
            placeholder="Budget, solde, dépenses…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <p>
            Chaque aperçu utilise vos données actuelles. Une nouvelle instance
            possède ses propres réglages.
          </p>
          <div className="segmented" aria-label="Périmètre du catalogue">
            <button
              aria-pressed={!allCatalog}
              onClick={() => setAllCatalog(false)}
            >
              Familles recommandées
            </button>
            <button
              aria-pressed={allCatalog}
              onClick={() => setAllCatalog(true)}
            >
              Toutes les cartes disponibles
            </button>
          </div>
          {!catalog.length && (
            <p role="status">
              Aucune carte ne correspond à cette recherche. Essayez un autre
              nom.
            </p>
          )}
          <div className="board-catalog">
            {catalog.map((type) => (
              <article className="catalog-card" key={type}>
                <LivePreview tone={defaultTone(type)}>
                  {children(type, defaultSize(type))}
                </LivePreview>
                <b>{widgetNames[type]}</b>
                <p>{contractFor(type).question}</p>
                {familyNotes[type] && <small>{familyNotes[type]}</small>}
                <small>
                  {sizeLabels[defaultSize(type)]} ·{" "}
                  {view.instances.filter((i) => i.type === type).length} déjà
                  présente(s)
                </small>
                <button
                  className="button"
                  disabled={view.instances.length >= 100}
                  aria-label={`Ajouter ${widgetNames[type]}`}
                  onClick={() => add(type)}
                >
                  <Plus size={18} />
                  Ajouter cette carte
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {message}
      </p>
      <div
        ref={container}
        className={`free-board-container ${editing ? "free-editing" : ""} ${placing ? "free-placing" : ""}`}
        data-live-gesture={Boolean(gesture.current)}
        inert={busy || undefined}
        onClick={(event) => {
          if (!placing || !active || !container.current) return;
          const rect = container.current.getBoundingClientRect(),
            col = (width + 16) / 24;
          if (
            place(active.id, {
              x: Math.floor((event.clientX - rect.left) / col),
              y: Math.floor((event.clientY - rect.top) / 12),
            })
          )
            setPlacing(false);
        }}
      >
        <GridLayout
          width={width}
          layout={
            (mobile
              ? order.reduce<BoardPosition[]>((stack, id) => {
                  const p = layout.find((box) => box.i === id)!;
                  const previous = stack.at(-1);
                  stack.push({
                    ...p,
                    x: 0,
                    y: previous ? previous.y + previous.h + 2 : 0,
                    w: 1,
                    minW: 1,
                    maxW: 1,
                  });
                  return stack;
                }, [])
              : layout
            ).map((p) => ({ ...p, moved: resetGesture })) as Layout
          }
          gridConfig={{
            cols: mobile ? 1 : 24,
            rowHeight: boardRowHeight,
            margin: [16, 0],
            containerPadding: [0, 0],
          }}
          compactor={liveCompactor}
          dragConfig={{
            enabled: editing && !busy && !mobile,
            handle: ".drag-handle",
            cancel: "input,select",
            threshold: 5,
          }}
          resizeConfig={{
            enabled: editing && !busy && !mobile,
            handles: ["e"],
            handleComponent: (axis, ref) => (
              <span
                ref={ref as Ref<HTMLSpanElement>}
                className={`react-resizable-handle react-resizable-handle-${axis}`}
                role="button"
                tabIndex={0}
                aria-label="Changer la taille de contenu par la largeur"
                title="Glisser horizontalement pour choisir une taille. Flèches gauche/droite au clavier ; Entrée pour les réglages. La hauteur s’adapte au contenu."
                onKeyDown={(event) => {
                  const id =
                    event.currentTarget.closest<HTMLElement>("[data-instance]")
                      ?.dataset.instance;
                  const instance = view.instances.find((i) => i.id === id);
                  if (!instance) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setActiveId(instance.id);
                  } else if (
                    event.key === "ArrowLeft" ||
                    event.key === "ArrowRight"
                  ) {
                    event.preventDefault();
                    const sizes = sizesFor(instance.type);
                    const index = sizes.indexOf(instance.size);
                    const size =
                      sizes[
                        Math.max(
                          0,
                          Math.min(
                            sizes.length - 1,
                            index + (event.key === "ArrowRight" ? 1 : -1),
                          ),
                        )
                      ];
                    replaceView(resizeInstance(view, instance.id, size));
                  }
                }}
              />
            ),
          }}
          onDragStart={startGesture}
          onDrag={trackGesture}
          onDragStop={stopGesture}
          onResizeStart={startGesture}
          onResize={trackGesture}
          onResizeStop={stopGesture}
          className="free-layout"
        >
          {order.map((id) =>
            renderTile(view.instances.find((i) => i.id === id)!),
          )}
        </GridLayout>
        {placing && (
          <div
            className="free-placement-overlay"
            aria-hidden="true"
            style={{
              height: Math.max(
                600,
                ...layout.map((p) => (p.y + p.h + 20) * 12),
              ),
            }}
          />
        )}
      </div>
    </div>
  );
}
const InstanceContent = memo(function InstanceContent({
  instance,
  render,
  update,
}: {
  instance: BoardInstance;
  render: (
    id: WidgetId,
    size: WidgetSize,
    instance?: BoardInstance,
  ) => ReactNode;
  update: (id: string, change: Partial<BoardInstance>) => Promise<void>;
}) {
  const context = useMemo(
    () => ({
      instance,
      update: (change: Partial<BoardInstance>) => update(instance.id, change),
    }),
    [instance, update],
  );
  return (
    <BoardInstanceContext.Provider value={context}>
      {render(instance.type, instance.size, instance)}
    </BoardInstanceContext.Provider>
  );
});
function MeasuredContent({
  id,
  onMeasure,
  children,
}: {
  id: string;
  onMeasure: (id: string, height: number) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (ref.current)
      onMeasure(id, Math.ceil(ref.current.getBoundingClientRect().height));
  });
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const update = () =>
      onMeasure(id, Math.ceil(node.getBoundingClientRect().height));
    const observer = new ResizeObserver(() => flushSync(update));
    observer.observe(node);
    update();
    return () => observer.disconnect();
  }, [id, onMeasure]);
  return (
    <div ref={ref} className="free-tile-content">
      {children}
    </div>
  );
}
function LivePreview({
  children,
  tone,
}: {
  children: ReactNode;
  tone: BoardTone;
}) {
  const box = useRef<HTMLDivElement>(null),
    content = useRef<HTMLDivElement>(null),
    [scale, setScale] = useState(0.6),
    [height, setHeight] = useState(330);
  useEffect(() => {
    if (!box.current || typeof ResizeObserver === "undefined") return;
    const update = () => {
      const scale = (box.current?.clientWidth ?? 300) / 520;
      setScale(scale);
      setHeight(Math.ceil((content.current?.offsetHeight ?? 550) * scale));
    };
    const observer = new ResizeObserver(update);
    observer.observe(box.current);
    if (content.current) observer.observe(content.current);
    update();
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={box}
      className="catalog-preview free-preview"
      style={{ height }}
      aria-hidden="true"
      inert
    >
      <div
        ref={content}
        className={`board-tile ${cardPaletteClassName(tone)}`}
        style={{
          ...cardPaletteStyle(tone),
          width: 520,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}
