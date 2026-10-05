/** Route changes only: never refocus on financial writes or editor rerenders. */
export function focusRouteHeading(root: Document = document) {
  let stopped = false;
  const observer = new MutationObserver(focus);
  const timeout = setTimeout(stop, 5000);
  function stop() {
    stopped = true;
    observer.disconnect();
    clearTimeout(timeout);
    root.removeEventListener("pointerdown", stop);
    root.removeEventListener("keydown", stop);
  }
  function focus() {
    if (stopped) return;
    const heading = [...root.querySelectorAll<HTMLElement>("main h1")].find(
      (el) =>
        !el.closest("[hidden], [inert], [aria-hidden='true']") &&
        (!el.checkVisibility || el.checkVisibility()),
    );
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    stop();
  }
  observer.observe(root.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["hidden", "style", "inert"],
  });
  root.addEventListener("pointerdown", stop);
  root.addEventListener("keydown", stop);
  focus();
  return stop;
}
