import {
  createElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import "./sortable.css";

/** Moves `id` to `toIndex` (clamped). Used by « Monter », « Descendre »… */
export function moveItem<T>(ids: readonly T[], id: T, toIndex: number): T[] {
  if (!ids.includes(id)) return [...ids];
  const next = ids.filter((item) => item !== id);
  next.splice(Math.max(0, Math.min(next.length, toIndex)), 0, id);
  return next;
}

export interface SortableOptions<T extends string> {
  ids: readonly T[];
  onCommit: (next: T[]) => void;
  /** grid: ordered flow of variable-size cells · y: vertical list. */
  axis: "grid" | "y";
  /** Spoken name of an item, e.g. « Solde ». */
  label: (id: T) => string;
  disabled?: boolean;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Drag<T> {
  id: T;
  mode: "pointer" | "keyboard";
  grabX: number;
  grabY: number;
  clientX: number;
  clientY: number;
  width: number;
  height: number;
  lastSwap: { x: number; y: number } | null;
  dockHeight: number;
  radius: string;
}

const EDGE = 80;
const MAX_SPEED = 22;
const SWAP_SLOP = 12;
const FLIP = { duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" };

const same = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const reducedMotion = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Page-coordinate rect of an element, ignoring any transform we applied. */
function layoutRect(element: HTMLElement): Rect {
  const transform = element.style.transform;
  element.style.transform = "";
  element.getAnimations?.().forEach((animation) => {
    if (animation.id === "sortable-flip") animation.cancel();
  });
  const box = element.getBoundingClientRect();
  element.style.transform = transform;
  return {
    left: box.left + scrollX,
    top: box.top + scrollY,
    width: box.width,
    height: box.height,
  };
}

export function useSortable<T extends string>({
  ids,
  onCommit,
  axis,
  label,
  disabled = false,
}: SortableOptions<T>) {
  const [preview, setPreview] = useState<T[] | null>(null);
  const [pending, setPending] = useState<T[] | null>(null);
  const [activeId, setActiveId] = useState<T | null>(null);
  const [mode, setMode] = useState<Drag<T>["mode"] | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [flip, setFlip] = useState(0);
  const instructions = useId();

  const order = preview ?? pending ?? [...ids];
  const latest = useRef({ order, ids, onCommit, label, axis });
  latest.current = { order, ids, onCommit, label, axis };

  const items = useRef(new Map<T, HTMLElement>());
  const handles = useRef(new Map<T, HTMLElement>());
  const itemRefs = useRef(new Map<T, (element: HTMLElement | null) => void>());
  const handleRefs = useRef(
    new Map<T, (element: HTMLElement | null) => void>(),
  );
  const layout = useRef(new Map<T, Rect>());
  const first = useRef<Map<T, DOMRect> | null>(null);
  const drag = useRef<Drag<T> | null>(null);
  const placeholderRef = useRef<HTMLDivElement | null>(null);
  const cleanup = useRef<(() => void) | null>(null);

  // A committed order stays displayed until `ids` reflects it.
  const committedFrom = useRef<string>("");
  useEffect(() => {
    if (!pending) return;
    const key = ids.join("\u0000");
    if (same(ids, pending) || key !== committedFrom.current) setPending(null);
    const timer = setTimeout(() => setPending(null), 1500);
    return () => clearTimeout(timer);
  }, [ids, pending]);

  const position = (id: T, list = latest.current.order) =>
    `position ${list.indexOf(id) + 1} sur ${list.length}`;

  const snapshot = () => {
    const rects = new Map<T, DOMRect>();
    items.current.forEach((element, id) =>
      rects.set(id, element.getBoundingClientRect()),
    );
    return rects;
  };

  const measure = () => {
    layout.current = new Map();
    items.current.forEach((element, id) =>
      layout.current.set(id, layoutRect(element)),
    );
  };

  const follow = () => {
    const d = drag.current;
    if (!d) return;
    const element = items.current.get(d.id);
    const rect = layout.current.get(d.id);
    if (element && rect && d.mode === "pointer") {
      const dx = d.clientX - d.grabX - (rect.left - scrollX);
      const dy = d.clientY - d.grabY - (rect.top - scrollY);
      element.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    }
    const placeholder = placeholderRef.current;
    if (placeholder && rect) {
      placeholder.style.left = `${rect.left - scrollX}px`;
      placeholder.style.top = `${rect.top - scrollY}px`;
      placeholder.style.width = `${rect.width}px`;
      placeholder.style.height = `${rect.height}px`;
      placeholder.style.borderRadius = d.radius;
    }
  };

  const reorder = (next: T[]) => {
    first.current = snapshot();
    setPreview(next);
    setFlip((n) => n + 1);
  };

  // Insertion point = the other item whose centre is nearest to the pointer,
  // before it when the pointer is on its first half, after it otherwise.
  const evaluate = () => {
    const d = drag.current;
    if (!d || d.mode !== "pointer") return;
    const p = { x: d.clientX + scrollX, y: d.clientY + scrollY };
    if (
      d.lastSwap &&
      Math.hypot(p.x - d.lastSwap.x, p.y - d.lastSwap.y) < SWAP_SLOP
    )
      return;
    const { order: current, axis: direction } = latest.current;
    const others = current.filter((id) => id !== d.id);
    const rects = [...layout.current.values()];
    const span =
      Math.max(...rects.map((r) => r.left + r.width)) -
      Math.min(...rects.map((r) => r.left));
    let nearest: T | null = null;
    let best = Infinity;
    for (const id of others) {
      const r = layout.current.get(id);
      if (!r) continue;
      const distance = Math.hypot(
        p.x - (r.left + r.width / 2),
        p.y - (r.top + r.height / 2),
      );
      if (distance < best) [best, nearest] = [distance, id];
    }
    if (nearest === null) return;
    const r = layout.current.get(nearest)!;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const before =
      direction === "y" || r.width > span * 0.6
        ? p.y < cy
        : p.y < r.top
          ? true
          : p.y > r.top + r.height
            ? false
            : p.x < cx;
    const next = [...others];
    next.splice(others.indexOf(nearest) + (before ? 0 : 1), 0, d.id);
    if (same(next, current)) return;
    d.lastSwap = p;
    reorder(next);
  };

  const finish = (commit: boolean) => {
    const d = drag.current;
    if (!d) return;
    cleanup.current?.();
    cleanup.current = null;
    first.current = snapshot();
    const element = items.current.get(d.id);
    if (element) element.style.transform = "";
    const { order: finalOrder, ids: original, label: name } = latest.current;
    drag.current = null;
    if (commit && !same(finalOrder, original)) {
      committedFrom.current = original.join("\u0000");
      setPending(finalOrder);
      latest.current.onCommit(finalOrder);
    }
    setPreview(null);
    setActiveId(null);
    setMode(null);
    setFlip((n) => n + 1);
    setAnnouncement(
      commit
        ? `${name(d.id)} déposée en ${position(d.id, finalOrder)}`
        : "Déplacement annulé",
    );
    requestAnimationFrame(() =>
      handles.current.get(d.id)?.focus({ preventScroll: true }),
    );
  };

  const lift = (
    id: T,
    d: Omit<Drag<T>, "id" | "lastSwap" | "dockHeight" | "radius">,
  ) => {
    const dockHeight =
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--dock-h"),
      ) || 0;
    const element = items.current.get(id);
    const radius = element ? getComputedStyle(element).borderRadius : "";
    drag.current = { ...d, id, lastSwap: null, dockHeight, radius };
    setActiveId(id);
    setMode(d.mode);
    setPreview([...latest.current.order]);
    setFlip((n) => n + 1);
    setAnnouncement(`${latest.current.label(id)} soulevée, ${position(id)}`);
  };

  const startPointer = (id: T, event: ReactPointerEvent<HTMLElement>) => {
    if (disabled || drag.current || event.button !== 0) return;
    const element = items.current.get(id);
    if (!element) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const box = element.getBoundingClientRect();
    lift(id, {
      mode: "pointer",
      grabX: event.clientX - box.left,
      grabY: event.clientY - box.top,
      clientX: event.clientX,
      clientY: event.clientY,
      width: box.width,
      height: box.height,
    });

    let frame = 0;
    const scroll = () => {
      const d = drag.current;
      if (!d) return;
      const bottom = innerHeight - d.dockHeight;
      let speed = 0;
      if (d.clientY < EDGE) speed = -((EDGE - d.clientY) / EDGE) * MAX_SPEED;
      else if (d.clientY > bottom - EDGE)
        speed = Math.min(1, (d.clientY - (bottom - EDGE)) / EDGE) * MAX_SPEED;
      speed = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, speed));
      if (speed) {
        scrollBy(0, speed < 0 ? Math.floor(speed) : Math.ceil(speed));
        follow();
        evaluate();
      }
      frame = requestAnimationFrame(scroll);
    };
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      d.clientX = e.clientX;
      d.clientY = e.clientY;
      follow();
      evaluate();
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      finish(false);
    };
    const onScroll = () => {
      follow();
      evaluate();
    };
    const onResize = () => {
      measure();
      follow();
    };
    addEventListener("pointermove", onMove);
    addEventListener("pointerup", onUp);
    addEventListener("pointercancel", onCancel);
    addEventListener("keydown", onKey, true);
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onResize);
    document.documentElement.classList.add("ui-sorting");
    frame = requestAnimationFrame(scroll);
    cleanup.current = () => {
      cancelAnimationFrame(frame);
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerup", onUp);
      removeEventListener("pointercancel", onCancel);
      removeEventListener("keydown", onKey, true);
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onResize);
      document.documentElement.classList.remove("ui-sorting");
    };
  };

  const onHandleKey = (id: T, event: ReactKeyboardEvent<HTMLElement>) => {
    if (disabled) return;
    const d = drag.current;
    const activate = event.key === " " || event.key === "Enter";
    if (!d) {
      if (!activate) return;
      event.preventDefault();
      const element = items.current.get(id);
      const box = element?.getBoundingClientRect();
      lift(id, {
        mode: "keyboard",
        grabX: 0,
        grabY: 0,
        clientX: 0,
        clientY: 0,
        width: box?.width ?? 0,
        height: box?.height ?? 0,
      });
      return;
    }
    if (d.id !== id || d.mode !== "keyboard") return;
    if (activate) {
      event.preventDefault();
      finish(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      finish(false);
    } else if (
      ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"].includes(event.key)
    ) {
      event.preventDefault();
      const current = latest.current.order;
      const step =
        event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
      const target = current.indexOf(id) + step;
      if (target < 0 || target >= current.length) return;
      const next = moveItem(current, id, target);
      reorder(next);
      setAnnouncement(`${latest.current.label(id)}, ${position(id, next)}`);
    }
  };

  // Measure and animate after every reorder, lift or drop.
  useLayoutEffect(() => {
    const before = first.current;
    first.current = null;
    measure();
    follow();
    if (!before || reducedMotion()) return;
    const d = drag.current;
    items.current.forEach((element, id) => {
      if (d?.mode === "pointer" && d.id === id) return;
      const from = before.get(id);
      const to = layout.current.get(id);
      if (!from || !to) return;
      const dx = from.left - (to.left - scrollX);
      const dy = from.top - (to.top - scrollY);
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      element.animate?.(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
        { ...FLIP, id: "sortable-flip" },
      );
    });
    if (d) {
      const handle = handles.current.get(d.id);
      if (handle && document.activeElement !== handle)
        handle.focus({ preventScroll: true });
    }
  }, [flip]);

  useEffect(() => () => cleanup.current?.(), []);

  const itemRef = (id: T) => {
    let ref = itemRefs.current.get(id);
    if (!ref) {
      ref = (element) => {
        if (element) items.current.set(id, element);
        else items.current.delete(id);
      };
      itemRefs.current.set(id, ref);
    }
    return ref;
  };

  const handleRef = (id: T) => {
    let ref = handleRefs.current.get(id);
    if (!ref) {
      ref = (element) => {
        if (element) handles.current.set(id, element);
        else handles.current.delete(id);
      };
      handleRefs.current.set(id, ref);
    }
    return ref;
  };

  const getItemProps = (id: T) => {
    const lifted = id === activeId;
    const d = drag.current;
    return {
      ref: itemRef(id),
      "data-sort-item": "",
      "data-sort-state": lifted ? "lifted" : activeId ? "shifting" : undefined,
      "data-sort-mode": lifted ? (mode ?? undefined) : undefined,
      style:
        lifted && d
          ? ({ width: d.width, height: d.height } as CSSProperties)
          : undefined,
    };
  };

  const getHandleProps = (id: T) => ({
    ref: handleRef(id),
    "aria-label": `Déplacer ${label(id)}`,
    "aria-describedby": instructions,
    "aria-pressed": id === activeId,
    "aria-disabled": disabled || undefined,
    "data-sort-handle": "",
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) =>
      startPointer(id, event),
    onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) =>
      onHandleKey(id, event),
    // Reordering moves DOM nodes, which can blur the handle; only a real
    // focus change (still away on the next frame) drops the item.
    onBlur: () =>
      requestAnimationFrame(() => {
        const d = drag.current;
        if (
          d?.mode === "keyboard" &&
          d.id === id &&
          document.activeElement !== handles.current.get(id)
        )
          finish(true);
      }),
  });

  const placeholder: ReactNode =
    activeId && mode === "pointer" && typeof document !== "undefined"
      ? createPortal(
          createElement("div", {
            ref: placeholderRef,
            className: "ui-sort-placeholder",
            "aria-hidden": true,
          }),
          document.body,
        )
      : null;

  const status: ReactNode = createElement(
    "span",
    { className: "sr-only" },
    createElement(
      "span",
      { id: instructions },
      "Espace pour soulever, flèches pour déplacer, Espace pour déposer, Échap pour annuler.",
    ),
    createElement(
      "span",
      { "aria-live": "assertive", "aria-atomic": true },
      announcement,
    ),
  );

  return {
    order,
    activeId,
    getItemProps,
    getHandleProps,
    placeholder,
    status,
    announcement,
  };
}
