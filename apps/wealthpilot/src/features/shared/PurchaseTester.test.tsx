import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { anchored, budget, ledgerOf } from "../../domain/test-fixtures";
import { PurchaseTester } from "./PurchaseTester";

const ledger = () =>
  ledgerOf(
    {
      accounts: [anchored("A", "2026-10-05", 100000)],
      budgets: [budget("r", "2026-10", "Restaurants", 10000)],
      prefs: { safety: 20000 },
    },
    "2026-10-05",
  );

const amount = () => screen.getByRole("textbox", { name: "Montant" });
const verdict = () => document.querySelector(".purchase-verdict")?.textContent;

describe("PurchaseTester", () => {
  it("answers live, and says an in-envelope purchase does not lower free money twice", () => {
    render(<PurchaseTester ledger={ledger()} account="" />);
    expect(verdict()).toBeUndefined();
    fireEvent.change(amount(), { target: { value: "35" } });
    expect(verdict()?.replace(/\u202f/g, " ")).toContain(
      "Oui · il restera 65 € en Restaurants",
    );
    expect(screen.getByText(/ne baisse pas une 2ᵉ fois/)).toBeTruthy();
  });

  it("flags a purchase outside the envelope, then one that breaks the reserve", () => {
    render(<PurchaseTester ledger={ledger()} account="" />);
    fireEvent.change(amount(), { target: { value: "150" } });
    expect(verdict()).toMatch(/^Possible, hors enveloppe · libre/);
    expect(screen.queryByText(/ne baisse pas/)).toBeNull();
    fireEvent.change(amount(), { target: { value: "900" } });
    expect(verdict()).toMatch(/^Non · Foyer passe sous la réserve le/);
  });

  it("rejects an invalid amount and a date outside the bounds, and clears", () => {
    render(
      <PurchaseTester
        ledger={ledger()}
        account=""
        minDate="2026-10-05"
        maxDate="2026-10-11"
      />,
    );
    fireEvent.change(amount(), { target: { value: "abc" } });
    expect(screen.getByText("Montant invalide")).toBeTruthy();
    fireEvent.change(amount(), { target: { value: "10" } });
    const date = screen.getByLabelText("Date") as HTMLInputElement;
    expect(date.value).toBe("2026-10-05");
    fireEvent.change(date, { target: { value: "2026-10-20" } });
    expect(screen.getByText("Au plus tard le 11 oct.")).toBeTruthy();
    expect(verdict()).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: "Effacer" }));
    expect((amount() as HTMLInputElement).value).toBe("");
    expect(date.value).toBe("2026-10-05");
  });
});
