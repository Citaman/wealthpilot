import { afterEach, expect, it, vi } from "vitest";
import { focusRouteHeading } from "./route-focus";
afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});
it("focuses only the visible route heading, not a hidden mounted page", () => {
  document.body.innerHTML =
    "<div hidden><main><h1>Dashboard</h1></main></div><main><h1>Comptes</h1></main>";
  const stop = focusRouteHeading();
  expect(document.activeElement?.textContent).toBe("Comptes");
  stop();
});
it("waits for a lazy page then disconnects, preserving an editor focus on later writes", async () => {
  document.body.innerHTML = "<div hidden><main><h1>Dashboard</h1></main></div>";
  const stop = focusRouteHeading();
  document.body.insertAdjacentHTML(
    "beforeend",
    '<main><h1>Comptes</h1><input aria-label="Nom" /></main>',
  );
  await Promise.resolve();
  expect(document.activeElement?.textContent).toBe("Comptes");
  const input = document.querySelector("input")!;
  input.focus();
  document.body.insertAdjacentHTML("beforeend", "<span>Solde actualisé</span>");
  await Promise.resolve();
  expect(document.activeElement).toBe(input);
  stop();
});
it("does not steal focus if the user interacts while a lazy page is loading", async () => {
  document.body.innerHTML = "<button>Navigation</button>";
  const button = document.querySelector("button")!;
  button.focus();
  const stop = focusRouteHeading();
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
  document.body.insertAdjacentHTML(
    "beforeend",
    "<main><h1>Comptes</h1></main>",
  );
  await Promise.resolve();
  expect(document.activeElement).toBe(button);
  stop();
});
