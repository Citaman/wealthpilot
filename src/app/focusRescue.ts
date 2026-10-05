import { useEffect } from "react";

const FOCUSABLE =
  "button:not([disabled]), a[href], input:not([disabled]):not([type=hidden]), select, textarea, [tabindex]:not([tabindex='-1'])";
// Floating layers and toasts hand focus back themselves.
const TRANSIENT =
  "[data-radix-popper-content-wrapper], [role=dialog], .toast-host";

interface Anchor {
  element: HTMLElement;
  /** Neighbouring rows, nearest first: where focus goes if the element's row disappears. */
  neighbours: Element[];
  ancestors: Element[];
}

function anchorOf(element: HTMLElement): Anchor {
  const row = element.closest("li, tr, [data-card-id]") ?? element;
  return {
    element,
    neighbours: [row.nextElementSibling, row.previousElementSibling].filter(
      (e): e is Element => e !== null,
    ),
    ancestors: (() => {
      const list: Element[] = [];
      for (
        let e = row.parentElement;
        e && e !== document.body;
        e = e.parentElement
      )
        list.push(e);
      return list;
    })(),
  };
}

const firstFocusable = (root: Element) =>
  [root, ...root.querySelectorAll<HTMLElement>(FOCUSABLE)].find(
    (e): e is HTMLElement =>
      e instanceof HTMLElement &&
      e.matches(FOCUSABLE) &&
      !e.closest("[hidden], [inert]") &&
      e.getClientRects().length > 0,
  );

/**
 * After a mutation removes the focused control (a row deleted, a line stopped), focus moves
 * to the next logical element — the neighbouring row, else the container, else the page
 * title — never to `body`.
 */
export function useFocusRescue() {
  useEffect(() => {
    let anchor: Anchor | null = null;
    let timer = 0;
    const onFocus = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && !target.closest(TRANSIENT))
        anchor = anchorOf(target);
    };
    const rescue = () => {
      if (document.activeElement !== document.body || !anchor) return;
      if (anchor.element.isConnected) return;
      const target =
        anchor.neighbours
          .filter((e) => e.isConnected)
          .map(firstFocusable)
          .find(Boolean) ??
        anchor.ancestors
          .filter((e) => e.isConnected)
          .map(firstFocusable)
          .find(Boolean) ??
        document.querySelector<HTMLElement>(".page:not([hidden]) h1");
      target?.focus({ preventScroll: true });
    };
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      // After floating layers have returned focus to their trigger.
      timer = window.setTimeout(rescue, 60);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    addEventListener("focusin", onFocus);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
      removeEventListener("focusin", onFocus);
    };
  }, []);
}
