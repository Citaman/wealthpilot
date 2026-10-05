import { useEffect, useMemo, useSyncExternalStore } from "react";

export const pages = ["dashboard", "week", "transactions", "import"] as const;
export type Page = (typeof pages)[number];

export interface Route {
  page: Page;
  params: URLSearchParams;
}

const paths: Record<Page, string> = {
  dashboard: "",
  week: "semaine",
  transactions: "transactions",
  import: "import",
};

// v1 hashes (#week, #transactions…) and retired pages keep working.
const legacy: Record<string, Page> = {
  week: "week",
  "week-calculation": "week",
  transactions: "transactions",
  import: "import",
  data: "import",
};

export function parseHash(hash: string): Route & { canonical: boolean } {
  const raw = hash.replace(/^#\/?/, "");
  const [path, query = ""] = raw.split("?");
  const params = new URLSearchParams(query);
  const page = (Object.keys(paths) as Page[]).find((p) => paths[p] === path);
  if (page) return { page, params, canonical: true };
  return { page: legacy[path] ?? "dashboard", params, canonical: false };
}

export function hrefFor(page: Page, params?: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {}))
    if (value) query.set(key, value);
  const q = query.toString();
  return `#/${paths[page]}${q ? `?${q}` : ""}`;
}

export function navigate(page: Page, params?: Record<string, string | undefined>) {
  const next = hrefFor(page, params);
  if (location.hash !== next) location.hash = next;
}

/** Drops drilldown params without adding a history entry. */
export function clearParams(page: Page) {
  history.replaceState(null, "", hrefFor(page));
  dispatchEvent(new HashChangeEvent("hashchange"));
}

const subscribe = (notify: () => void) => {
  addEventListener("hashchange", notify);
  return () => removeEventListener("hashchange", notify);
};

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => location.hash);
  const route = useMemo(() => parseHash(hash), [hash]);
  useEffect(() => {
    if (!route.canonical)
      history.replaceState(null, "", hrefFor(route.page, Object.fromEntries(route.params)));
  }, [route]);
  return route;
}
