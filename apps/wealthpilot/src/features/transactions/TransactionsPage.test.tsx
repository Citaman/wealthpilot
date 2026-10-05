import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ReadingProvider } from "../../app/context";
import { ToastProvider, useToastList } from "../../app/toast";
import { restoreBackup, validateBackup } from "../../data/backup";
import { db } from "../../data/db";
import { useLedger, useLoaded } from "../../data/hooks";
import { resetDatabase } from "../../data/test-utils";
import { demoSnapshot } from "../../dev/demo";
import { pageWindow } from "./Pagination";
import { TransactionsPage } from "./TransactionsPage";

const AS_OF = "2026-10-05";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(async () => {
  localStorage.clear();
  await resetDatabase();
  await restoreBackup(
    validateBackup({
      format: "wealthpilot-next",
      version: 1,
      data: demoSnapshot(AS_OF),
    }),
  );
});

function Toasts() {
  const { toasts } = useToastList();
  return (
    <div data-testid="toasts">
      {toasts.map((t) => (
        <button key={t.id} onClick={() => void t.action?.run()}>
          {t.message}
        </button>
      ))}
    </div>
  );
}

function Harness({ params = "" }: { params?: string }) {
  const ledger = useLedger(AS_OF);
  const loaded = useLoaded();
  if (!loaded) return null;
  return (
    <ReadingProvider ledger={ledger} asOf={AS_OF}>
      <TransactionsPage
        ledger={ledger}
        params={new URLSearchParams(params)}
        active
      />
      <Toasts />
    </ReadingProvider>
  );
}

const renderPage = async (params?: string) => {
  render(
    <ToastProvider>
      <Harness params={params} />
    </ToastProvider>,
  );
  await screen.findByRole("table", { name: "Opérations" });
};

const rows = () =>
  [...document.querySelectorAll<HTMLElement>("tbody tr[data-row]")];

describe("Pagination", () => {
  it("garde la première et la dernière page avec des ellipses", () => {
    expect(pageWindow(0, 10)).toEqual([1, 2, 3, 4, null, 10]);
    expect(pageWindow(4, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
    expect(pageWindow(9, 10)).toEqual([1, null, 7, 8, 9, 10]);
    expect(pageWindow(1, 4)).toEqual([1, 2, 3, 4]);
  });

  it("change de page, borne « Aller à » et met le focus sur la première ligne", async () => {
    localStorage.setItem("wealthpilot-period", "all");
    await renderPage();
    const top = screen.getByRole("navigation", { name: "Pagination (haut)" });
    const total = Number(
      within(top).getByText(/sur/).parentElement!.textContent!.match(/sur\s*([\d\s ]+)/)![1].replace(/\D/g, ""),
    );
    expect(total).toBeGreaterThan(100);
    await userEvent.click(within(top).getByRole("button", { name: "Page 2" }));
    expect(top.textContent).toContain("26–50");
    const bottom = screen.getByRole("navigation", { name: "Pagination (bas)" });
    expect(bottom.textContent).toContain("26–50");
    await waitFor(() => expect(document.activeElement).toBe(rows()[0]));
    const jump = within(bottom).getByRole("textbox");
    await userEvent.type(jump, "999{Enter}");
    const last = Math.ceil(total / 25);
    expect(
      within(top).getByRole("button", { name: `Page ${last}` }),
    ).toHaveProperty("ariaCurrent", "page");
  });
});

describe("Clavier et sélection", () => {
  it("navigue, ouvre le détail, ferme à Échap et coche à Espace", async () => {
    await renderPage();
    const [first, second] = rows();
    act(() => first.focus());
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(document.activeElement).toBe(second);
    fireEvent.keyDown(second, { key: "Enter" });
    expect(screen.getByRole("region", { name: /^Détail de/ })).toBeTruthy();
    fireEvent.keyDown(second, { key: "Escape" });
    expect(screen.queryByRole("region", { name: /^Détail de/ })).toBeNull();
    fireEvent.keyDown(second, { key: " " });
    expect(second.getAttribute("aria-selected")).toBe("true");
    const bar = screen.getByRole("region", { name: "Sélection" });
    expect(bar.textContent).toContain("1 sélectionnée");
  });
});

describe("Catégorie", () => {
  it("crée une catégorie depuis le menu puis annule", async () => {
    await renderPage();
    const row = rows().find((r) => r.textContent?.includes("PAYPAL"))!;
    await userEvent.click(within(row).getByRole("button", { name: /Catégorie/ }));
    const input = await screen.findByRole("combobox", { name: "Rechercher ou créer une catégorie" });
    await userEvent.type(input, "Jeux vidéo{Enter}");
    const stored = () =>
      db.transactions
        .filter((t) => t.merchant === "PAYPAL *STEAM")
        .first()
        .then((t) => t?.category);
    await waitFor(async () => expect(await stored()).toBe("Jeux vidéo"));
    const toast = await screen.findByRole("button", { name: "Catégorie changée" });
    await userEvent.click(toast);
    await waitFor(async () => expect(await stored()).toBe("À catégoriser"));
  });

  it("filtre les opérations à catégoriser depuis un drilldown", async () => {
    await renderPage("filter=uncategorized");
    expect(rows().length).toBe(2);
    expect(screen.getByRole("list", { name: "Filtres actifs" }).textContent).toContain(
      "Sans catégorie",
    );
  });
});
