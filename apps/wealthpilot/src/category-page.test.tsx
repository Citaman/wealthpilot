import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useLiveQuery } from "dexie-react-hooks";
import { CategoriesPage } from "./CategoryPage";
import { CategoriesTreeEditor } from "./CategoriesTreeEditor";
import { db } from "./store";
import { emptySnapshot } from "./types";
beforeEach(async () => {
  await db.preferences.clear();
  await db.transactions.clear();
  await db.accounts.clear();
});
const props = {
  from: "2026-10",
  month: "2026-10",
  account: "",
  notify: vi.fn(),
};
describe("Page catégories — parcours réel", () => {
  it("associe puis renomme une catégorie avec aperçu explicite et annulation", async () => {
    await db.accounts.put({ id: "A" });
    await db.preferences.put(structuredClone(emptySnapshot.preferences));
    await db.transactions.put({
      id: "t",
      batchId: "b",
      date: "2026-10-04",
      amount: -1000,
      account: "A",
      merchant: "Marché",
      label: "MARCHÉ",
      category: "Courses",
      internal: false,
      fingerprint: "t",
      raw: {},
    });
    function Page() {
      const s = useLiveQuery(() => db.snapshot());
      return s ? <CategoriesTreeEditor snapshot={s} notify={vi.fn()} /> : null;
    }
    render(<Page />);
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Préparer leur association stable",
      }),
    );
    expect((await db.transactions.get("t"))?.categoryId).toBeUndefined();
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmer cet impact" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Modifier catégorie Courses" }),
    );
    const id = (await db.transactions.get("t"))?.categoryId;
    expect(id).toBeTruthy();
    fireEvent.change(
      screen.getByRole("textbox", { name: "Nom de catégorie" }),
      { target: { value: "Alimentation" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Prévisualiser la modification" }),
    );
    expect((await db.transactions.get("t"))?.category).toBe("Courses");
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmer cet impact" }),
    );
    await screen.findByRole("button", {
      name: "Modifier catégorie Alimentation",
    });
    expect((await db.transactions.get("t"))?.categoryId).toBe(id);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Annuler la modification d’arborescence",
      }),
    );
    await screen.findByRole("button", { name: "Modifier catégorie Courses" });
    expect((await db.transactions.get("t"))?.category).toBe("Courses");
  });
  it("enregistre, teste, applique et annule une règle sur le périmètre visible", async () => {
    await db.accounts.put({ id: "A" });
    await db.preferences.put(structuredClone(emptySnapshot.preferences));
    await db.transactions.put({
      id: "t",
      batchId: "b",
      date: "2026-10-04",
      amount: -1000,
      account: "A",
      merchant: "Free Mobile",
      label: "FREE MOBILE",
      category: "À catégoriser",
      internal: false,
      fingerprint: "t",
      raw: {},
    });
    function Page() {
      const s = useLiveQuery(() => db.snapshot());
      return s ? <CategoriesPage {...props} snapshot={s} /> : null;
    }
    render(<Page />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Créer une règle" }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Nom de la règle" }), {
      target: { value: "Téléphonie" },
    });
    fireEvent.change(
      screen.getByRole("textbox", { name: "Mots du libellé ou de l’entité" }),
      { target: { value: "free mobile" } },
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "Catégorie cible" }),
      { target: { value: "Télécom" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer la règle" }),
    );
    await screen.findByRole("button", { name: "Modifier Téléphonie" });
    expect((await db.transactions.get("t"))?.category).toBe("À catégoriser");
    fireEvent.click(
      screen.getByRole("button", { name: "Tester sur ce périmètre" }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Appliquer aux 1 opérations proposées",
      }),
    );
    await screen.findByRole("button", { name: "Annuler cette application" });
    expect((await db.transactions.get("t"))?.category).toBe("Télécom");
    fireEvent.click(
      screen.getByRole("button", { name: "Annuler cette application" }),
    );
    await waitFor(async () =>
      expect((await db.transactions.get("t"))?.category).toBe("À catégoriser"),
    );
  });
  it("annuler un nouveau brouillon ne sauvegarde aucune règle", async () => {
    render(
      <CategoriesPage {...props} snapshot={structuredClone(emptySnapshot)} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Créer une règle" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nom de la règle" }), {
      target: { value: "À ne pas garder" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect((await db.preferences.get("main"))?.categoryRules).toBeUndefined();
    expect(
      screen.queryByRole("textbox", { name: "Nom de la règle" }),
    ).toBeNull();
  });
});
