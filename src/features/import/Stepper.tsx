import { Check } from "lucide-react";

const steps = ["Fichier", "Compte", "Vérification", "Terminé"] as const;

/** Compact progress of the import: done steps keep their accent and a check. */
export function Stepper({ current }: { current: number }) {
  return (
    <ol className="import-steps" aria-label="Étapes de l'import">
      {steps.map((label, index) => {
        const state =
          index < current ? "done" : index === current ? "active" : "todo";
        return (
          <li
            key={label}
            className="import-step"
            data-state={state}
            data-index={index}
            aria-current={state === "active" ? "step" : undefined}
          >
            <span className="import-step-dot" aria-hidden>
              {state === "done" || (state === "active" && index === 3) ? (
                <Check size={14} strokeWidth={3} />
              ) : (
                index + 1
              )}
            </span>
            <span className="import-step-label">
              {label}
              {state === "done" && <span className="sr-only"> (fait)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
