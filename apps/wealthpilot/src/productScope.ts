import { widgetNames, type WidgetId } from "./types";
import type { BoardState } from "./layout";

// Retired presentation families remain readable in backups, never in the UI.
const retired = new Set<WidgetId>([
  "goal",
  "goals",
  "goalDate",
  "effort",
  "savings",
]);
export const isActiveWidget = (id: WidgetId) => !retired.has(id);
export const activeWidgetIds = (Object.keys(widgetNames) as WidgetId[]).filter(
  isActiveWidget,
);

export function activeBoard(board: BoardState): BoardState {
  return {
    ...board,
    legacy: {
      ...board.legacy,
      widgets: board.legacy.widgets.filter(isActiveWidget),
    },
    views: board.views.map((view) => {
      const instances = view.instances.filter((i) => isActiveWidget(i.type));
      const ids = new Set(instances.map((i) => i.id));
      return {
        ...view,
        instances,
        mobileOrder: view.mobileOrder.filter((id) => ids.has(id)),
        layouts: {
          laptop: view.layouts.laptop.filter((p) => ids.has(p.i)),
          desktop: view.layouts.desktop.filter((p) => ids.has(p.i)),
          wide: view.layouts.wide.filter((p) => ids.has(p.i)),
        },
      };
    }),
  };
}
