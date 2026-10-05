import { beforeEach, describe, it, expect, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { DashboardBoard } from "./DashboardBoard";
import { Dashboard } from "./Dashboard";
import { db } from "./store";
import { emptySnapshot, type Snapshot } from "./types";
import { addInstance, makeInstance, migrateBoard } from "./layout";
import { useBoardInstance } from "./BoardInstanceContext";
beforeEach(async () => {
  await db.preferences.clear();
});
function board(s: Snapshot, onFinish = vi.fn()) {
  return render(
    <DashboardBoard snapshot={s} editing notify={vi.fn()} onFinish={onFinish}>
      {(id, size, instance) => (
        <span>
          {id}/{size}/{instance?.source.kind}
        </span>
      )}
    </DashboardBoard>,
  );
}
function RepresentationButton() {
  const context = useBoardInstance()!;
  return (
    <button
      onClick={() =>
        void context.update({ representation: "rings" }).catch(() => {})
      }
    >
      Anneaux {context.instance.id}
    </button>
  );
}
describe("G1/G2 — acceptation réelle de l’état de grille", () => {
  it("la poignée latérale nommée change une taille sémantique au clavier, sans fausse hauteur libre", async () => {
    const s = structuredClone(emptySnapshot);
    s.preferences.widgets = ["balance"];
    await db.preferences.put(s.preferences);
    const { container } = board(s);
    expect(
      container.querySelectorAll(
        ".react-resizable-handle-s,.react-resizable-handle-se",
      ),
    ).toHaveLength(0);
    fireEvent.keyDown(
      screen.getByRole("button", {
        name: "Changer la taille de contenu par la largeur",
      }),
      { key: "ArrowLeft" },
    );
    fireEvent.click(screen.getByRole("button", { name: "Terminer" }));
    await waitFor(async () =>
      expect(
        (await db.preferences.get("main"))?.board?.views[0].instances[0].size,
      ).toBe("small"),
    );
  });
  it("trois réglages rapides sur trois cartes ne se rejettent ni ne s’écrasent", async () => {
    const s = structuredClone(emptySnapshot);
    const state = migrateBoard({ ...s.preferences, widgets: [] });
    for (const id of ["a", "b", "c"])
      state.views[0] = addInstance(state.views[0], makeInstance("balance", id));
    s.preferences.board = state;
    await db.preferences.put(s.preferences);
    const notify = vi.fn();
    render(
      <DashboardBoard
        snapshot={s}
        editing={false}
        notify={notify}
        onFinish={vi.fn()}
      >
        {() => <RepresentationButton />}
      </DashboardBoard>,
    );
    for (const id of ["a", "b", "c"])
      fireEvent.click(screen.getByRole("button", { name: `Anneaux ${id}` }));
    await waitFor(async () =>
      expect(
        (await db.preferences.get("main"))?.board?.views[0].instances.map(
          (i) => i.representation,
        ),
      ).toEqual(["rings", "rings", "rings"]),
    );
    expect(notify).not.toHaveBeenCalled();
  });
  it("une vraie édition concurrente de la même propriété reste protégée", async () => {
    const s = structuredClone(emptySnapshot);
    s.preferences.widgets = ["balance"];
    s.preferences.board = migrateBoard(s.preferences);
    await db.preferences.put(s.preferences);
    const notify = vi.fn();
    render(
      <DashboardBoard
        snapshot={s}
        editing={false}
        notify={notify}
        onFinish={vi.fn()}
      >
        {() => <RepresentationButton />}
      </DashboardBoard>,
    );
    const other = structuredClone(s.preferences);
    other.board!.views[0].instances[0].representation = "tiles";
    other.board!.revision++;
    await db.preferences.put(other);
    fireEvent.click(
      screen.getByRole("button", { name: "Anneaux legacy-balance" }),
    );
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        expect.stringContaining("autre onglet"),
      ),
    );
    expect(
      (await db.preferences.get("main"))?.board?.views[0].instances[0]
        .representation,
    ).toBe("tiles");
  });
  it("nomme correctement le solde d’un compte au lieu du foyer", () => {
    const s = structuredClone(emptySnapshot);
    s.preferences.widgets = ["balance"];
    s.accounts = [
      { id: "A", checkpoint: { date: "2026-10-04", amount: 123400 } },
    ];
    render(
      <Dashboard
        snapshot={s}
        month="2026-10"
        account="A"
        importPage={vi.fn()}
        notify={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Solde du compte" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: "Solde du foyer" }),
    ).toBeNull();
  });
  it("refuse la sauvegarde d’un onglet périmé et garde les préférences financières actuelles", async () => {
    const s = structuredClone(emptySnapshot);
    s.preferences.board = migrateBoard(s.preferences);
    await db.preferences.put(s.preferences);
    const done = vi.fn();
    board(s, done);
    await db.preferences.put({
      ...s.preferences,
      safety: 777,
      board: { ...s.preferences.board, revision: 1 },
    });
    fireEvent.click(screen.getByRole("button", { name: "Terminer" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("autre onglet"),
    );
    expect(done).not.toHaveBeenCalled();
    expect((await db.preferences.get("main"))?.safety).toBe(777);
    expect((await db.preferences.get("main"))?.board?.revision).toBe(1);
  });
  it("duplique une vraie instance, annule sans écrire et sauvegarde une copie de vue indépendante", async () => {
    const s = structuredClone(emptySnapshot);
    s.preferences.widgets = ["balance"];
    await db.preferences.put(s.preferences);
    board(s);
    fireEvent.click(
      screen.getByRole("button", { name: "Personnaliser Solde du foyer" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Dupliquer cette carte" }),
    );
    expect(document.querySelectorAll('[data-widget="balance"]')).toHaveLength(
      2,
    );
    expect((await db.preferences.get("main"))?.board).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: "Dupliquer la vue" }));
    fireEvent.click(screen.getByRole("button", { name: "Terminer" }));
    await waitFor(async () =>
      expect((await db.preferences.get("main"))?.board?.views).toHaveLength(2),
    );
    const saved = (await db.preferences.get("main"))!.board!;
    expect(saved.views[0].instances).toHaveLength(2);
    expect(saved.views[1].instances).toHaveLength(2);
    expect(
      new Set(saved.views.flatMap((v) => v.instances.map((i) => i.id))).size,
    ).toBe(4);
  });
  it("les flèches déplacent précisément et les voisins libèrent la place", async () => {
    const s = structuredClone(emptySnapshot);
    s.preferences.widgets = ["balance", "available"];
    await db.preferences.put(s.preferences);
    board(s);
    const first = screen.getByRole("button", {
      name: "Déplacer Solde du foyer",
    });
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(screen.getByRole("status").textContent).toContain(
      "espaces verticaux se referment",
    );
    fireEvent.keyDown(first, { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("button", { name: "Terminer" }));
    await waitFor(async () =>
      expect((await db.preferences.get("main"))?.board?.revision).toBe(1),
    );
    const positions = (await db.preferences.get("main"))!.board!.views[0]
      .layouts.laptop;
    expect(positions.find((p) => p.i === "legacy-balance")).toMatchObject({
      x: 1,
      y: positions.find((p) => p.i === "legacy-available")!.h + 2,
    });
    expect(positions.find((p) => p.i === "legacy-available")).toMatchObject({
      x: 12,
      y: 0,
    });
  });
  it("deux cartes de même type calculent leurs comptes indépendamment", () => {
    const s = structuredClone(emptySnapshot);
    s.preferences.widgets = [];
    s.accounts = [
      { id: "Personnel", checkpoint: { date: "2026-10-04", amount: 123400 } },
      { id: "Conjoint", checkpoint: { date: "2026-10-04", amount: 567800 } },
    ];
    const state = migrateBoard(s.preferences),
      a = makeInstance("balance", "one"),
      b = makeInstance("balance", "two");
    a.source = { kind: "account", account: "Personnel" };
    b.source = { kind: "account", account: "Conjoint" };
    state.views[0] = addInstance(addInstance(state.views[0], a), b);
    s.preferences.board = state;
    const { container } = render(
      <Dashboard
        snapshot={s}
        month="2026-10"
        account=""
        importPage={vi.fn()}
        notify={vi.fn()}
      />,
    );
    const one = container.querySelector('[data-instance="one"]') as HTMLElement,
      two = container.querySelector('[data-instance="two"]') as HTMLElement;
    expect(one.textContent).toContain("1 234");
    expect(two.textContent).toContain("5 678");
    expect(one.textContent).not.toContain("5 678");
    expect(two.textContent).not.toContain("1 234");
    expect(within(one).getByText("Personnel", { exact: true })).toBeTruthy();
  });
});
