import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { WeekPage } from "./WeekPage";
import { db } from "./store";
import { emptySnapshot } from "./types";
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-04T12:00:00Z"));
  await db.preferences.clear();
});
afterEach(() => vi.useRealTimers());
describe("weekly context preserves draft identity", () => {
  it("changing global account does not assign the open draft to the new payer", async () => {
    const s = structuredClone(emptySnapshot);
    s.accounts = [{ id: "A" }, { id: "B" }];
    s.preferences.weeklyPlans = [
      {
        start: "2026-09-28",
        account: "A",
        limits: { Courses: 10000 },
        reserve: 0,
        reduction: 0,
      },
    ];
    await db.preferences.put(s.preferences);
    const view = render(<WeekPage snapshot={s} account="A" notify={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Cette semaine" }));
    fireEvent.click(screen.getByRole("button", { name: "Ajuster ce plan" }));
    fireEvent.change(screen.getByLabelText("Objectif Courses (€)"), {
      target: { value: "321" },
    });
    view.rerender(<WeekPage snapshot={s} account="B" notify={vi.fn()} />);
    expect(screen.getByText(/Ce brouillon concerne toujours/)).toBeTruthy();
    expect(
      (screen.getByLabelText("Objectif Courses (€)") as HTMLInputElement).value,
    ).toBe("321");
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(async () =>
      expect(
        (await db.preferences.get("main"))?.weeklyPlans?.[0].limits.Courses,
      ).toBe(32100),
    );
    expect(
      (await db.preferences.get("main"))?.weeklyPlans?.map((p) => p.account),
    ).toEqual(["A"]);
  });
});
