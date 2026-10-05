import { useState, useEffect } from "react";
import {
  List,
  CircleDot,
  LayoutGrid,
  ChartNoAxesColumn,
  CalendarDays,
  Columns3,
  Grid2X2,
  Goal,
  ArrowDownRight,
} from "lucide-react";
import { euro, dateLabel } from "./domain";
import { db } from "./store";
import { defaultPreferences, type WidgetId, type WidgetSize } from "./types";
import { readableMarkColor, seriesColor, distinctSeriesColors } from "./visual";
import { useBoardInstance } from "./BoardInstanceContext";
import "./component-compositions.css";
import {
  visualizationLabels,
  visualizationsFor,
  type VisualizationId,
} from "./visualizationRegistry";
import { VisualizationRenderer } from "./VisualizationRenderer";
import "./visualization-variants.css";
export type VizItem = {
  name: string;
  value: number;
  detail?: string;
  target?: number;
  color?: string;
  icon?: React.ReactNode;
  date?: string;
};
export function DataViz({
  items,
  limit,
  widget,
  initial = "bars",
  size = "medium",
  colors,
}: {
  items: VizItem[];
  limit: number;
  widget: WidgetId;
  initial?: VisualizationId;
  size?: WidgetSize;
  colors?: Record<string, string>;
}) {
  const context = useBoardInstance();
  const selectedView = context?.instance.representation;
  const preferred =
    selectedView && selectedView !== "default" ? selectedView : initial;
  const [view, setView] = useState(preferred),
    [error, setError] = useState("");
  useEffect(() => setView(preferred), [preferred]);
  const shown = (
      widget === "charges"
        ? [...items].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
        : items
    ).slice(0, limit),
    signed = items.some((i) => i.value < 0),
    total = items.reduce((n, i) => n + Math.max(0, i.value), 0),
    progress = items.some((i) => i.target !== undefined);
  const max = Math.max(1, ...items.map((i) => Math.abs(i.value)));
  // A net flow overlaps its income/expense operands: it is not a slice of a whole.
  const variants = visualizationsFor(widget);
  const unavailable = (candidate: VisualizationId) =>
    !variants.includes(candidate) ||
    (["rings", "stacked", "waffle"].includes(candidate) && signed) ||
    (candidate === "bullet" && !items.some((item) => (item.target ?? 0) > 0)) ||
    (candidate === "timeline" && !items.some((item) => item.date)) ||
    (candidate === "waterfall" &&
      (items.length !== 3 ||
        items[0].value < 0 ||
        items[1].value < 0 ||
        items[2].value !== items[0].value - items[1].value));
  const compact = size === "tiny" || size === "small";
  const hasAlternatives = size !== "tiny" && variants.length > 1;
  const effectiveView = size === "tiny" || unavailable(view) ? "bars" : view;
  const automaticColors = distinctSeriesColors([
    ...items.filter((item) => !item.color).map((item) => item.name),
    "Autres",
  ]);
  const color = (item: VizItem) =>
    item.color
      ? readableMarkColor(item.color, context?.instance.tone)
      : readableMarkColor(
          colors?.[item.name] ??
            automaticColors[item.name] ??
            seriesColor(item.name),
          context?.instance.tone,
        );
  const ratio = (item: VizItem) =>
    Math.max(
      0,
      Math.min(
        1,
        item.target !== undefined
          ? item.target > 0
            ? item.value / item.target
            : 0
          : item.value / Math.max(1, widget === "balance" ? max : total),
      ),
    );
  return (
    <div
      className={`data-viz data-viz-${size}${(size === "large" || size === "xlarge") && shown.length > 3 ? " data-viz-multicolumn" : ""}`}
    >
      {size !== "tiny" && (
        <div className="viz-switch" aria-label="Représentation">
          <span>
            {progress
              ? widget === "effort"
                ? "Effort mensuel prévu / nécessaire"
                : "Avancement par projet"
              : signed
                ? "Montants signés"
                : widget === "flows"
                  ? "Comparaison des montants"
                  : "Répartition des montants"}
          </span>
          {hasAlternatives && (
            <div className="segmented">
              {variants.map((v) => {
                const label = visualizationLabels[v],
                  Icon = {
                    bars: List,
                    rings: CircleDot,
                    tiles: LayoutGrid,
                    stacked: Columns3,
                    waffle: Grid2X2,
                    bullet: Goal,
                    columns: ChartNoAxesColumn,
                    waterfall: ArrowDownRight,
                    line: ChartNoAxesColumn,
                    area: ChartNoAxesColumn,
                    timeline: CalendarDays,
                  }[v];
                return (
                  <button
                    key={v}
                    aria-label={`${label} — ${widget}`}
                    title={
                      unavailable(v)
                        ? `${label} indisponible : données incompatibles ou cible/date manquante.`
                        : label
                    }
                    aria-pressed={effectiveView === v}
                    disabled={unavailable(v)}
                    onClick={async () => {
                      setView(v);
                      try {
                        if (context) {
                          await context.update({ representation: v });
                          setError("");
                          return;
                        }
                        await db.transaction("rw", db.preferences, async () => {
                          const p =
                            (await db.preferences.get("main")) ??
                            defaultPreferences;
                          await db.preferences.put({
                            ...p,
                            widgetViews: { ...p.widgetViews, [widget]: v },
                          });
                        });
                        setError("");
                      } catch {
                        setView(effectiveView);
                        setError("Cette vue n’a pas pu être sauvegardée.");
                      }
                    }}
                  >
                    <Icon size={16} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      <div className={`viz-composition viz-composition-${effectiveView}`}>
        {!["bars", "rings", "tiles"].includes(effectiveView) && (
          <VisualizationRenderer
            view={effectiveView}
            items={shown}
            all={items}
            color={color}
            showTotal={widget !== "balance" && widget !== "savings"}
          />
        )}
        {effectiveView === "rings" && (
          <svg
            className="concentric-chart"
            viewBox="0 0 240 240"
            role="img"
            aria-label={
              progress
                ? "Anneaux concentriques : avancement de chaque cible"
                : widget === "balance"
                  ? "Anneaux concentriques : même échelle, maximum des comptes"
                  : "Anneaux concentriques : part de chaque montant dans le total"
            }
          >
            {shown.slice(0, 5).map((item, i) => (
              <g key={item.name}>
                <circle
                  cx="120"
                  cy="120"
                  r={106 - i * 17}
                  fill="none"
                  stroke="var(--track,#ccc)"
                  strokeWidth="11"
                />
                <circle
                  cx="120"
                  cy="120"
                  r={106 - i * 17}
                  fill="none"
                  stroke={color(item)}
                  strokeWidth="11"
                  strokeLinecap="round"
                  pathLength="100"
                  strokeDasharray={`${ratio(item) * 100} 100`}
                  strokeOpacity={ratio(item) > 0 ? 1 : 0}
                  transform="rotate(-90 120 120)"
                />
              </g>
            ))}
            <text x="120" y="125" textAnchor="middle" fill="currentColor">
              {progress ? "Progression" : euro(total)}
            </text>
          </svg>
        )}
        {["bars", "rings", "tiles"].includes(effectiveView) && (
          <div
            className={`viz-items viz-${effectiveView === "rings" ? "bars" : effectiveView}`}
          >
            {shown.map((item, i) => (
              <div
                className="viz-item"
                key={item.name + i}
                style={{ "--item-color": color(item) } as React.CSSProperties}
              >
                <div className="viz-label">
                  {item.icon}
                  {effectiveView === "rings" && !item.icon && (
                    <span className="viz-ring-key" aria-hidden="true" />
                  )}
                  <b>{item.name}</b>
                  <strong>{euro(item.value)}</strong>
                </div>
                {effectiveView !== "rings" && (
                  <div className="viz-track-bar">
                    <i
                      style={{
                        width: `${Math.min(100, (progress ? ratio(item) : Math.abs(item.value) / max) * 100)}%`,
                      }}
                    />
                  </div>
                )}
                {item.detail && (!compact || widget === "effort") && (
                  <small>{item.detail}</small>
                )}
                {item.date && <small>{dateLabel(item.date)}</small>}
                {progress && (
                  <small>
                    {item.target
                      ? `${Math.round((item.value / item.target) * 100)} % de la cible${item.value > item.target ? " · cible dépassée" : ""}`
                      : "Cible à définir"}
                  </small>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {items.length > limit && (
        <small>
          {shown.length} sur {items.length}
        </small>
      )}
      {!items.length && <p>Aucune donnée sur cette période.</p>}
      {!signed && effectiveView === "rings" && !progress && (
        <small>
          {widget === "balance"
            ? "Même échelle pour chaque compte : le plus grand solde = un tour. Rayons non proportionnels aux euros."
            : "Chaque anneau indique la part du total, pas un objectif."}{" "}
        </small>
      )}
      {effectiveView === "rings" && shown.length > 5 && (
        <small>
          Les cinq premiers anneaux sont affichés ; les autres éléments restent
          dans la liste.
        </small>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
