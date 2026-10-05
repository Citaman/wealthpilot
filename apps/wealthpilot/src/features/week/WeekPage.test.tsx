import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ReadingProvider } from "../../app/context";
import { PageScope } from "../../app/DockSlot";
import { ToastProvider, useToastList } from "../../app/toast";
import { db, readPreferences } from "../../data/db";
import { resetDatabase } from "../../data/test-utils";
import { anchored, ledgerOf, tx } from "../../domain/test-fixtures";
import { WeekPage } from "./WeekPage";

const ledger = ledgerOf(
  {
    accounts: [anchored("A", "2026-10-05", 100000)],
    transactions: [
      tx("old", "2026-09-01", -2000),
      tx("lunch", "2026-10-05", -1250, {
        category: "Courses",
        merchant: "Lidl",
      }),
    ],
    prefs: {
      weeklyPlans: [
        {
          start: "2026-10-05",
          account: "",
          limits: { Courses: 8000 },
          reduction: 0,
          reserve: 0,
        },
      ],
    },
  },
  "2026-10-05",
);

function Toasts() {
  const { toasts, dismiss } = useToastList();
  return toasts.map((t) => (
    <button
      key={t.id}
      onClick={() => {
        dismiss(t.id);
        void t.action?.run();
      }}
    >
      {t.message} · Annuler
    </button>
  ));
}

const renderPage = () =>
  render(
    <ToastProvider>
      <ReadingProvider ledger={ledger} asOf="2026-10-05">
        <PageScope target={null} active>
          <WeekPage ledger={ledger} params={new URLSearchParams()} active />
        </PageScope>
      </ReadingProvider>
      <Toasts />
    </ToastProvider>,
  );

const savedLimits = async () =>
  (await readPreferences(db)).weeklyPlans?.find((p) => p.start === "2026-10-05")
    ?.limits;

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe("WeekPage", () => {
  beforeEach(async () => {
    await resetDatabase();
    await db.preferences.put({
      ...(await readPreferences(db)),
      weeklyPlans: ledger.prefs.weeklyPlans,
    });
  });

  it("edits a week limit inline, persists it, and undoes it from the toast", async () => {
    renderPage();
    fireEvent.click(
      screen.getByRole("button", { name: "Limite Courses : modifier" }),
    );
    const input = screen.getByRole("textbox", { name: "Limite Courses" });
    fireEvent.change(input, { target: { value: "120" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(async () =>
      expect(await savedLimits()).toEqual({ Courses: 12000 }),
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: /Limite Courses .* · Annuler/,
      }),
    );
    await waitFor(async () =>
      expect(await savedLimits()).toEqual({ Courses: 8000 }),
    );
  });

  it("resets a saved limit to the proposal", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /^Proposé/ }));
    await waitFor(async () => expect(await savedLimits()).toBeUndefined());
  });

  it("opens a day's operations from the strip and closes them with Escape", () => {
    renderPage();
    const monday = screen.getByRole("button", { name: /^lundi 5 octobre/ });
    fireEvent.click(monday);
    expect(
      screen.getByRole("region", { name: "lundi 5 octobre" }).textContent,
    ).toContain("Lidl");
    fireEvent.keyDown(monday, { key: "Escape" });
    expect(
      screen.queryByRole("region", { name: "lundi 5 octobre" }),
    ).toBeNull();
  });
});
