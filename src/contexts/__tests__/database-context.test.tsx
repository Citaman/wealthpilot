import { StrictMode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DatabaseProvider, useDatabase } from "../database-context";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { initializeDatabase, open, blockedListeners } = vi.hoisted(() => ({
  initializeDatabase: vi.fn<() => Promise<void>>(),
  open: vi.fn<() => Promise<void>>(),
  blockedListeners: new Set<() => void>(),
}));

vi.mock("@/lib/db", () => ({
  initializeDatabase,
  db: {
    isOpen: () => false,
    open,
    on: (event: string, listener?: () => void) => {
      if (event === "blocked" && listener) blockedListeners.add(listener);
      return {
        unsubscribe: (value: () => void) => blockedListeners.delete(value),
      };
    },
  },
}));

function Status() {
  return <output>{useDatabase().status}</output>;
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
  blockedListeners.clear();
});

describe("DatabaseProvider", () => {
  it("atteint ready après le remontage des effets en Strict Mode", async () => {
    let releaseOpen: (() => void) | undefined;
    open.mockImplementation(() => new Promise<void>((resolve) => {
      releaseOpen = resolve;
    }));
    initializeDatabase.mockResolvedValue();

    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <StrictMode>
          <DatabaseProvider><Status /></DatabaseProvider>
        </StrictMode>
      );
    });
    expect(host.textContent).toBe("initializing");

    await act(async () => {
      releaseOpen?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toBe("ready");
    expect(open).toHaveBeenCalledTimes(1);
    expect(initializeDatabase).toHaveBeenCalledTimes(1);

    await act(async () => root.unmount());
  });
});
