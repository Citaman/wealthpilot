import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { App } from "./App";
import { emptySnapshot } from "./types";
import { activePageIds, dockPageIds } from "./navigation";

let snapshot = structuredClone(emptySnapshot);
vi.mock("./useSnapshot", () => ({ useSnapshot: () => snapshot }));
vi.mock("./Dashboard", () => ({
  Dashboard: ({
    navigatePage,
  }: {
    navigatePage: (
      page: string,
      scope: { account: string; month: string },
    ) => void;
  }) => (
    <main>
      <h1>Dashboard témoin</h1>
      <button
        onClick={() =>
          navigatePage("accounts", { account: "B", month: "2026-03" })
        }
      >
        Ancienne action compte
      </button>
      <button
        onClick={() =>
          navigatePage("goals", { account: "B", month: "2026-03" })
        }
      >
        Ancienne action hors périmètre
      </button>
    </main>
  ),
}));
vi.mock("./WeekPage", () => ({
  WeekPage: () => (
    <main>
      <h1>Ma semaine témoin</h1>
    </main>
  ),
}));
vi.mock("./TransactionsPage", () => ({
  TransactionsPage: () => (
    <main>
      <h1>Transactions témoin</h1>
    </main>
  ),
}));
vi.mock("./ImportPage", () => ({
  ImportPage: ({ onImported }: { onImported: (month: string) => void }) => (
    <main>
      <h1>Import CSV témoin</h1>
      <button onClick={() => onImported("2026-09")}>Import réussi</button>
    </main>
  ),
}));
vi.mock("./Editors", () => ({
  EditorDialog: ({ kind, onClose }: { kind: string; onClose: () => void }) => (
    <section aria-label={kind}>
      <h2>Sauvegarde locale témoin</h2>
      <button onClick={onClose}>Fermer la sauvegarde</button>
    </section>
  ),
}));
beforeEach(() => {
  history.replaceState(null, "", "/#dashboard");
  localStorage.clear();
  snapshot = structuredClone(emptySnapshot);
  snapshot.accounts = [{ id: "A" }, { id: "B" }];
  snapshot.transactions = [
    {
      id: "t",
      account: "A",
      date: "2026-10-02",
      amount: -1000,
      merchant: "Test",
      label: "Test",
      category: "Courses",
      raw: {},
      internal: false,
      fingerprint: "t",
      batchId: "test",
    },
  ];
});
describe("App — seulement les quatre pages approuvées", () => {
  it("le dock navigue vers les quatre vrais écrans, sans menu de pages supplémentaire", () => {
    render(<App />);
    for (const [label, heading] of [
      ["Ma semaine", "Ma semaine témoin"],
      ["Transactions", "Transactions témoin"],
      ["Import CSV", "Import CSV témoin"],
      ["Dashboard", "Dashboard témoin"],
    ]) {
      fireEvent.click(screen.getByRole("button", { name: label }));
      expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
    }
    expect(
      screen.queryByRole("combobox", { name: "Page de l’application" }),
    ).toBeNull();
    expect(screen.queryByRole("link", { name: /Maquettes/ })).toBeNull();
  });
  it("les URL retirées n’affichent jamais les anciens écrans ni un autre écran par défaut", () => {
    render(<App />);
    for (const page of dockPageIds.filter(
      (page) => !activePageIds.some((active) => active === page),
    )) {
      act(() => {
        history.replaceState(null, "", "/#" + page);
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      });
      expect(
        screen.getByRole("heading", {
          name: "Cette page n’est plus proposée.",
        }),
      ).toBeTruthy();
      expect(
        screen.queryByRole("heading", { name: "Dashboard témoin" }),
      ).toBeNull();
      expect(location.hash).toBe("#" + page);
    }
    fireEvent.click(
      screen.getByRole("button", { name: "Ouvrir le dashboard" }),
    );
    expect(
      screen.getByRole("heading", { name: "Dashboard témoin" }),
    ).toBeTruthy();
  });
  it("une ancienne action ne change ni la page ni le compte ni la période, et explique son indisponibilité", () => {
    render(<App />);
    const before = screen.getByRole("combobox", {
      name: "Compte affiché",
    }).textContent;
    fireEvent.click(
      screen.getByRole("button", { name: "Ancienne action compte" }),
    );
    expect(location.hash).toBe("#dashboard");
    expect(
      screen.getByRole("combobox", { name: "Compte affiché" }).textContent,
    ).toBe(before);
    expect(screen.getByRole("status").textContent).toContain(
      "quatre pages actuelles",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Ancienne action hors périmètre" }),
    );
    expect(location.hash).toBe("#dashboard");
  });
  it("sauvegarde et restauration sont accessibles dans Import, sans route données ni assistant d’objectifs", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Import CSV" }));
    const open = screen.getByRole("button", {
      name: "Sauvegarder ou restaurer mes données",
    });
    fireEvent.click(open);
    expect(
      screen.getByRole("heading", { name: "Sauvegarde locale témoin" }),
    ).toBeTruthy();
    expect(location.hash).toBe("#import");
    fireEvent.click(
      screen.getByRole("button", { name: "Fermer la sauvegarde" }),
    );
    expect(document.activeElement).toBe(open);
    fireEvent.click(screen.getByRole("button", { name: "Import réussi" }));
    expect(
      screen.getByRole("heading", { name: "Dashboard témoin" }),
    ).toBeTruthy();
  });
  it("un espace sans transactions conduit à Import sans créer de nouveaux objectifs", () => {
    snapshot.transactions = [];
    const before = structuredClone(snapshot);
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "Import CSV témoin" }),
    ).toBeTruthy();
    expect(snapshot).toEqual(before);
  });
});
