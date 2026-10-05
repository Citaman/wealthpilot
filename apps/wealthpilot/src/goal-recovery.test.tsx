import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { GoalRecovery } from "./GoalRecovery";

const backup = {
  meta: { formatVersion: 1 },
  tables: {
    goals: [
      { id: 1, name: "Emergency Fund", targetAmount: 3000, currentAmount: 500 },
    ],
    budgets: [],
  },
};
function choose(text: string) {
  fireEvent.change(screen.getByLabelText("Sauvegarde des anciens objectifs"), {
    target: {
      files: [
        { name: "fixture.json", size: text.length, text: async () => text },
      ],
    },
  });
}
describe("Aperçu de récupération des objectifs", () => {
  it("retire l’aperçu précédent si le nouveau fichier est invalide", async () => {
    render(<GoalRecovery currentGoals={[]} onRecovered={vi.fn()} />);
    choose(JSON.stringify(backup));
    await screen.findByRole("button", { name: "Confirmer la récupération" });
    choose("invalid json");
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Confirmer la récupération" }),
      ).toBeNull(),
    );
    expect(screen.queryByText("Emergency Fund")).toBeNull();
  });
  it("annonce un objectif conservé et montre l’effet de son remplacement avant confirmation", async () => {
    render(
      <GoalRecovery
        currentGoals={[{ name: "Fonds de sécurité", target: 300000, saved: 0 }]}
        onRecovered={vi.fn()}
      />,
    );
    choose(JSON.stringify(backup));
    await screen.findByText(
      "0 objectifs ajoutés · 0 remplacés · 1 conservés sans modification.",
    );
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Remplacer les objectifs déjà présents/,
      }),
    );
    expect(
      screen.getByText(
        "0 objectifs ajoutés · 1 remplacés · 0 conservés sans modification.",
      ),
    ).toBeTruthy();
  });
});
