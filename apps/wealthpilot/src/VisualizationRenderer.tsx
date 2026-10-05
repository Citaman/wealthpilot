import type { CSSProperties } from "react";
import type { VizItem } from "./DataViz";
import type { VisualizationId } from "./visualizationRegistry";
import { euro, dateLabel } from "./domain";

export function VisualizationRenderer({
  view,
  items,
  all,
  color,
  showTotal = true,
}: {
  view: VisualizationId;
  items: VizItem[];
  all: VizItem[];
  color: (item: VizItem) => string;
  showTotal?: boolean;
}) {
  const total = all.reduce((sum, item) => sum + Math.max(0, item.value), 0);
  const remainder = Math.max(
    0,
    total - items.reduce((sum, item) => sum + Math.max(0, item.value), 0),
  );
  const parts = remainder
    ? [...items, { name: "Autres", value: remainder }]
    : items;
  const style = (item: VizItem) =>
    ({ "--item-color": color(item) }) as CSSProperties;
  if (view === "stacked" || view === "waffle") {
    const shares = parts.map((item) => ({
      item,
      percent: total ? (item.value / total) * 100 : 0,
    }));
    const cells = shares.map((p) => Math.floor(p.percent));
    const ranked = shares
      .map((p, index) => ({ index, remainder: p.percent - cells[index] }))
      .sort((a, b) => b.remainder - a.remainder);
    for (
      let n = 0;
      n < (total ? 100 - cells.reduce((sum, n) => sum + n, 0) : 0);
      n++
    )
      cells[ranked[n % ranked.length].index]++;
    return (
      <figure className={`special-viz ${view}-viz`}>
        <figcaption>
          {showTotal && <strong>{euro(total)}</strong>}
          <span>Total réparti · montants positifs</span>
        </figcaption>
        {view === "stacked" ? (
          <div
            className="proportion-strip"
            role="img"
            aria-label="Répartition proportionnelle du total"
          >
            {shares
              .filter((p) => p.percent > 0)
              .map(({ item, percent }, index) => (
                <span
                  key={index}
                  title={`${item.name} : ${percent.toFixed(1)} %`}
                  style={{ ...style(item), flexBasis: `${percent}%` }}
                />
              ))}
          </div>
        ) : (
          <div
            className="waffle-grid"
            role="img"
            aria-label="Mosaïque de cent cases, une case représente environ un pour cent du total"
          >
            {shares.flatMap(({ item }, index) =>
              Array.from({ length: cells[index] }, (_, n) => (
                <i key={`${index}-${n}`} style={style(item)} />
              )),
            )}
            {!total &&
              Array.from({ length: 100 }, (_, n) => (
                <i key={n} className="empty-cell" />
              ))}
          </div>
        )}
        <ul className="share-legend">
          {shares.map(({ item, percent }, i) => (
            <li key={i} style={style(item)}>
              <span className="share-key" />
              <b>{item.name}</b>
              <strong>{euro(item.value)}</strong>
              <small>
                {percent.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}{" "}
                %
              </small>
            </li>
          ))}
        </ul>
        {view === "waffle" && (
          <small>
            Cases arrondies ; les montants et pourcentages de la légende restent
            exacts.
          </small>
        )}
      </figure>
    );
  }
  if (view === "bullet")
    return (
      <div className="bullet-viz">
        {items.map((item, i) => {
          const target = item.target ?? 0,
            extent = Math.max(target, item.value, 1),
            pct = (item.value / extent) * 100,
            marker = (target / extent) * 100;
          return (
            <article key={i} style={style(item)}>
              <div className="bullet-heading">
                {item.icon}
                <b>{item.name}</b>
                <strong>{euro(item.value)}</strong>
              </div>
              {target > 0 ? (
                <>
                  <div
                    className="bullet-axis"
                    role="img"
                    aria-label={`${item.name} : ${euro(item.value)} sur une cible de ${euro(target)}`}
                  >
                    <span className="bullet-range" />
                    <i style={{ width: `${Math.max(0, pct)}%` }} />
                    <b
                      className="bullet-target"
                      style={{ left: `${marker}%` }}
                    />
                  </div>
                  <div className="bullet-scale">
                    <span>0 €</span>
                    <span>Cible {euro(target)}</span>
                    <strong>{Math.round((item.value / target) * 100)} %</strong>
                  </div>
                </>
              ) : (
                <small>Cible à définir — aucune jauge fictive</small>
              )}
              {item.detail && <small>{item.detail}</small>}
            </article>
          );
        })}
      </div>
    );
  if (view === "timeline") {
    const groups = new Map<string, VizItem[]>();
    for (const item of [...items].sort((a, b) =>
      (a.date ?? "").localeCompare(b.date ?? ""),
    )) {
      const date = item.date ?? "Sans date";
      groups.set(date, [...(groups.get(date) ?? []), item]);
    }
    return (
      <ol className="payment-timeline">
        {[...groups].map(([date, entries]) => (
          <li key={date}>
            <div className="timeline-date">
              <time dateTime={date}>
                {date === "Sans date" ? date : dateLabel(date)}
              </time>
              <strong>
                {euro(entries.reduce((sum, item) => sum + item.value, 0))}
              </strong>
            </div>
            <div>
              {entries.map((item, i) => (
                <article key={i} style={style(item)}>
                  <span className="share-key" />
                  <b>{item.name}</b>
                  <strong>{euro(item.value)}</strong>
                  {item.detail && <small>{item.detail}</small>}
                </article>
              ))}
            </div>
          </li>
        ))}
      </ol>
    );
  }
  if (view === "columns" || view === "waterfall") {
    const waterfall = view === "waterfall";
    const data = waterfall
      ? items.slice(0, 3).map((item, index) => ({
          item,
          start: index === 1 ? items[0].value : 0,
          end: index === 1 ? items[0].value - item.value : item.value,
        }))
      : items.map((item) => ({ item, start: 0, end: item.value }));
    const high = Math.max(0, ...data.flatMap((d) => [d.start, d.end])),
      low = Math.min(0, ...data.flatMap((d) => [d.start, d.end])),
      span = Math.max(1, high - low);
    const y = (value: number) => 180 - ((value - low) / span) * 160;
    // Keep the zero reference, not two almost coincident labels when a small
    // negative net follows large inflows. Exact values remain in the legend.
    const ticks = [0];
    for (const value of [high, low])
      if (ticks.every((tick) => Math.abs(y(tick) - y(value)) >= 16))
        ticks.push(value);
    const width = 600,
      step = (width - 70) / Math.max(1, data.length),
      barWidth = Math.min(72, step * 0.6);
    return (
      <figure className="special-viz column-viz">
        <svg
          viewBox="0 0 600 216"
          role="img"
          aria-label={
            waterfall
              ? "Cascade : revenus moins dépenses égale flux net"
              : "Comparaison des montants sur une échelle commune"
          }
        >
          {ticks.map((value, i) => (
            <g key={i}>
              <line
                x1="60"
                x2="598"
                y1={y(value)}
                y2={y(value)}
                stroke="var(--track)"
              />
              <text x="54" y={y(value) + 4} textAnchor="end">
                {euro(value)}
              </text>
            </g>
          ))}
          {data.map(({ item, start, end }, i) => (
            <g key={i}>
              <rect
                x={70 + i * step + (step - barWidth) / 2}
                y={Math.min(y(start), y(end))}
                width={barWidth}
                height={Math.abs(y(start) - y(end))}
                rx="5"
                fill={color(item)}
              />
              <text x={70 + i * step + step / 2} y="207" textAnchor="middle">
                {i + 1}
              </text>
              {waterfall && i < data.length - 1 && (
                <line
                  x1={70 + i * step + (step + barWidth) / 2}
                  x2={70 + (i + 1) * step + (step - barWidth) / 2}
                  y1={y(end)}
                  y2={y(end)}
                  stroke="currentColor"
                  strokeDasharray="3 4"
                />
              )}
            </g>
          ))}
        </svg>
        <ol className="column-key">
          {data.map(({ item }, i) => (
            <li key={i} style={style(item)}>
              <b>
                {i + 1}. {item.name}
              </b>
              <strong>{euro(item.value)}</strong>
              {item.detail && <small>{item.detail}</small>}
            </li>
          ))}
        </ol>
        {waterfall && (
          <small>
            Les dépenses sont soustraites. Le flux net est un résultat, pas une
            troisième part à additionner.
          </small>
        )}
      </figure>
    );
  }
  return null;
}
