import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { saveDashboard, setSafety } from "./commands";
import { db } from "./db";
import {
  useDashboardLayout,
  useLedger,
  useLoaded,
  usePreferences,
  useTables,
} from "./hooks";
import { importText, resetDatabase } from "./test-utils";

beforeEach(resetDatabase);

const useAll = () => ({
  loaded: useLoaded(),
  tables: useTables(),
  prefs: usePreferences(),
  layout: useDashboardLayout(),
  ledger: useLedger("2026-10-05"),
  other: useLedger("2026-10-05"),
});

describe("Lecture réactive", () => {
  it("charge sans écrire, partage un Ledger et l’invalide seulement sur une donnée financière", async () => {
    await importText("date;amount;libelle\n2026-10-02;-10;Courses");
    const { result } = renderHook(useAll);
    expect(result.current.loaded).toBe(false);
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.prefs.safety).toBe(0);
    expect(await db.preferences.count()).toBe(0);
    expect(result.current.ledger.transactions).toHaveLength(1);
    expect(result.current.other).toBe(result.current.ledger);

    const { ledger, tables } = result.current;
    await act(() =>
      saveDashboard({
        version: 2,
        cards: [{ id: "c", type: "week", width: 4 }],
      }),
    );
    await waitFor(() =>
      expect(result.current.layout?.cards[0].type).toBe("week"),
    );
    expect(result.current.ledger).toBe(ledger);
    expect(result.current.tables).toBe(tables);

    await act(() => setSafety(50000));
    await waitFor(() => expect(result.current.ledger.prefs.safety).toBe(50000));
    expect(result.current.ledger).not.toBe(ledger);
    expect(result.current.tables).toBe(tables);
  });
});
