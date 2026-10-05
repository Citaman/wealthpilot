import type { ReactNode } from "react";
import "./Empty.css";

/** One line + an optional action: « Aucune enveloppe · Créer ». */
export function Empty({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <p className="ui-empty">
      <span>{children}</span>
      {action && (
        <>
          <span aria-hidden className="ui-empty-dot">
            ·
          </span>
          {action}
        </>
      )}
    </p>
  );
}
