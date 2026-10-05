import { expect, it } from "vitest";
import { withSubcategories } from "./subcategories";
import { tx } from "./test-fixtures";

it("sous-catégories : colonne brute, puis historique du commerçant, puis commerçant connu, sans rien inventer", () => {
  const rows = [
    // raw bank column wins
    tx("raw", "2026-10-01", -1200, {
      merchant: "Chez Paul",
      category: "Restaurants",
      raw: { "Sous-catégorie": "Brasserie" },
    }),
    // same merchant and category, no column: learns from the row above
    tx("history", "2026-10-02", -1500, {
      merchant: "Chez Paul",
      category: "Restaurants",
    }),
    // well-known merchant with no history
    tx("known", "2026-10-03", -900, {
      merchant: "McDonalds Paris",
      category: "Restaurants",
    }),
    // already stored: untouched
    tx("stored", "2026-10-04", -900, {
      merchant: "Lidl",
      category: "Courses",
      subcategory: "Épicerie fine",
    }),
    // nothing to go on
    tx("unknown", "2026-10-05", -900, {
      merchant: "Cabinet Dupont",
      category: "Santé",
    }),
  ];
  const [raw, history, known, stored, unknown] = withSubcategories(rows);
  expect(raw).toMatchObject({
    subcategory: "Brasserie",
    subcategorySource: "raw",
  });
  expect(history).toMatchObject({
    subcategory: "Brasserie",
    subcategorySource: "merchant",
  });
  expect(known).toMatchObject({
    subcategory: "Fast Food",
    subcategorySource: "known",
  });
  expect(stored.subcategory).toBe("Épicerie fine");
  expect(stored.subcategorySource).toBeUndefined();
  expect(unknown.subcategory).toBeUndefined();
  expect(rows[1].subcategory).toBeUndefined();
});
