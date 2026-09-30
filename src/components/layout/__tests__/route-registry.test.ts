import { describe, expect, it } from "vitest";
import { APP_ROUTES, MOBILE_PRIMARY_ROUTES, getRouteMeta, searchRoutes } from "../route-registry";

describe("registre des routes", () => {
  it("contient chaque destination de production une seule fois", () => {
    expect(APP_ROUTES.map((route) => route.href)).toEqual([
      "/", "/transactions", "/plan", "/analytics", "/budgets", "/goals",
      "/subscriptions", "/calendar", "/accounts", "/categories", "/import", "/settings",
    ]);
    expect(new Set(APP_ROUTES.map((route) => route.href)).size).toBe(APP_ROUTES.length);
  });

  it("limite la navigation mobile à quatre destinations", () => {
    expect(MOBILE_PRIMARY_ROUTES).toHaveLength(4);
  });

  it("résout les détails d’objectif et la recherche Catégories", () => {
    expect(getRouteMeta("/goals/1")?.title).toBe("Détail de l’objectif");
    expect(searchRoutes("catégories")[0]?.href).toBe("/categories");
  });
});
