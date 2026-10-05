import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EditorDialog } from "./Editors";
import { emptySnapshot } from "./types";
import { db } from "./store";
beforeEach(async () => {
  await db.budgets.clear();
  await db.preferences.clear();
});
const fixture = () => {
  const s = structuredClone(emptySnapshot);
  s.accounts = [{ id: "A" }, { id: "B" }];
  s.budgets = [
    {
      id: "oct-A",
      month: "2026-10",
      category: "Courses",
      amount: 10000,
      account: "A",
    },
  ];
  return s;
};
describe("Audit indépendant des brouillons dashboard", () => {
  it("ne redirige pas silencieusement un brouillon de budget vers un autre mois/compte", async () => {
    const s = fixture(),
      notify = vi.fn();
    await db.budgets.bulkPut(s.budgets);
    const props = {
      kind: "budgets" as const,
      snapshot: s,
      category: "",
      onClose: vi.fn(),
      notify,
      inline: true,
    };
    const view = render(
      <EditorDialog {...props} month="2026-10" account="A" />,
    );
    fireEvent.change(screen.getByLabelText("Catégorie"), {
      target: { value: "Courses" },
    });
    fireEvent.change(screen.getByLabelText("Budget mensuel (€)"), {
      target: { value: "200" },
    });
    view.rerender(<EditorDialog {...props} month="2026-11" account="B" />);
    expect(screen.getByText(/Ce brouillon concerne toujours A/)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Ajouter / remplacer l’enveloppe" }),
    );
    await waitFor(async () =>
      expect(
        notify.mock.calls.length + screen.queryAllByRole("alert").length,
      ).toBeGreaterThan(0),
    );
    expect(
      (await db.budgets.toArray()).filter(
        (b) => b.month === "2026-11" && b.account === "B",
      ),
    ).toHaveLength(0);
  });
  it("refuse de remplacer un budget modifié ailleurs depuis l’ouverture du formulaire", async () => {
    const s = fixture(),
      notify = vi.fn();
    await db.budgets.bulkPut(s.budgets);
    render(
      <EditorDialog
        kind="budgets"
        snapshot={s}
        month="2026-10"
        account="A"
        category=""
        onClose={vi.fn()}
        notify={notify}
        inline
      />,
    );
    fireEvent.change(screen.getByLabelText("Catégorie"), {
      target: { value: "Courses" },
    });
    fireEvent.change(screen.getByLabelText("Budget mensuel (€)"), {
      target: { value: "200" },
    });
    await db.budgets.update("oct-A", { amount: 30000 });
    fireEvent.click(
      screen.getByRole("button", { name: "Ajouter / remplacer l’enveloppe" }),
    );
    await waitFor(async () =>
      expect(
        notify.mock.calls.length + screen.queryAllByRole("alert").length,
      ).toBeGreaterThan(0),
    );
    expect((await db.budgets.get("oct-A"))?.amount).toBe(30000);
  });
  it("autorise deux sauvegardes successives de son propre brouillon, sans faux conflit", async () => {
    const s = fixture(),
      notify = vi.fn();
    await db.budgets.bulkPut(s.budgets);
    render(
      <EditorDialog
        kind="budgets"
        snapshot={s}
        month="2026-10"
        account="A"
        category=""
        onClose={vi.fn()}
        notify={notify}
        inline
      />,
    );
    fireEvent.change(screen.getByLabelText("Catégorie"), {
      target: { value: "Courses" },
    });
    for (const value of ["200", "250"]) {
      fireEvent.change(screen.getByLabelText("Budget mensuel (€)"), {
        target: { value },
      });
      fireEvent.click(
        screen.getByRole("button", { name: "Ajouter / remplacer l’enveloppe" }),
      );
      await waitFor(async () =>
        expect((await db.budgets.get("oct-A"))?.amount).toBe(
          Number(value) * 100,
        ),
      );
    }
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("ne supprime pas une enveloppe modifiée ailleurs", async () => {
    const s = fixture();
    await db.budgets.bulkPut(s.budgets);
    render(
      <EditorDialog
        kind="budgets"
        snapshot={s}
        month="2026-10"
        account="A"
        category=""
        onClose={vi.fn()}
        notify={vi.fn()}
        inline
      />,
    );
    await db.budgets.update("oct-A", { amount: 30000 });
    fireEvent.click(
      screen.getByRole("button", { name: "Retirer l’enveloppe" }),
    );
    await screen.findByRole("alert");
    expect((await db.budgets.get("oct-A"))?.amount).toBe(30000);
  });
});
