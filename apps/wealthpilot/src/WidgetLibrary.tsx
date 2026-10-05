import type { Snapshot, WidgetSize } from "./types";
import { DashboardBoard } from "./DashboardBoard";
import { Dashboard } from "./Dashboard";
import { makeInstance } from "./layout";
import { today } from "./domain";
export const sizeNames: Record<WidgetSize, string> = {
  tiny: "Mini",
  small: "Petit",
  medium: "Moyen",
  large: "Grand",
  xlarge: "Très grand",
};
/** Compatibility entrypoint: one editor, one model, no legacy ordering writer. */
export function WidgetLibrary({
  snapshot,
  onClose,
  notify,
}: {
  snapshot: Snapshot;
  onClose: () => void;
  notify: (s: string) => void;
}) {
  const month = today().slice(0, 7);
  return (
    <DashboardBoard
      snapshot={snapshot}
      editing
      onFinish={onClose}
      notify={notify}
    >
      {(type, size, instance) => (
        <Dashboard
          snapshot={snapshot}
          month={month}
          account=""
          importPage={onClose}
          notify={notify}
          card={instance ?? { ...makeInstance(type, `preview-${type}`), size }}
        />
      )}
    </DashboardBoard>
  );
}
