import { navigate } from "../../../app/router";
import { monthlyFlows } from "../../../domain/analytics";
import { formatMonth } from "../../../domain/dates";
import { sumBy } from "../../../domain/money";
import { CardShell, useCardWidth } from "../../../ui/CardShell";
import { Empty } from "../../../ui/Empty";
import { DivergingBars } from "../../../ui/charts/DivergingBars";
import { Tile } from "./Tile";
import type { CardProps } from "./types";
import "./FlowsCard.css";

/** Months shown per chosen width (½ · ⅔ · 1), fewer when the card is measured narrow. */
const monthsFor = (width: number, measured: number) =>
  Math.min(
    width >= 12 ? 12 : width >= 8 ? 6 : 4,
    Math.max(4, Math.floor(measured / 64)),
  );

const shortMonth = new Intl.DateTimeFormat("fr-FR", {
  month: "short",
  timeZone: "UTC",
});
const monthLabel = (key: string) => {
  const label = shortMonth.format(new Date(`${key}-15T12:00:00Z`));
  return label.charAt(0).toUpperCase() + label.slice(1);
};

export function FlowsCard(props: CardProps) {
  return (
    <CardShell
      palette={props.card.palette}
      title="Entrées et sorties"
      actions={<Legend />}
    >
      <Flows {...props} />
    </CardShell>
  );
}

function Legend() {
  return (
    <ul className="flows-legend mono" aria-hidden>
      <li data-series="income">Entrées</li>
      <li data-series="spending">Sorties</li>
      <li data-series="net">Net</li>
    </ul>
  );
}

function Flows({ card, ledger, account }: CardProps) {
  const { width } = useCardWidth();
  const count = monthsFor(card.width, width || 600);
  const flows = monthlyFlows(ledger, account, count);
  if (!flows.some((f) => f.income || f.spending))
    return <Empty>Aucune opération sur ces mois</Empty>;

  const year = ledger.asOf.slice(0, 4);
  const complete = flows.filter((f) => f.complete);
  const average = complete.length
    ? Math.round(sumBy(complete, (f) => f.spending) / complete.length)
    : null;
  const net = sumBy(flows, (f) => f.net);
  const byKey = new Map(flows.map((f) => [f.month, f]));

  return (
    <>
      <DivergingBars
        label={`Entrées et sorties par mois budgétaire, ${flows.length} mois`}
        data={flows.map((f) => ({
          key: f.month,
          label: monthLabel(f.month),
          title: formatMonth(f.month, year),
          income: f.income,
          spending: f.spending,
          incomplete: !f.complete,
        }))}
        onSelect={(key) => {
          const f = byKey.get(key);
          if (f)
            navigate("transactions", {
              from: f.range.from,
              to: f.range.to,
              acct: account || "household",
            });
        }}
      />
      <div className="tiles">
        {average !== null && (
          <Tile
            label="Sorties moyennes"
            value={-average}
            meta={`${complete.length} mois complet${complete.length > 1 ? "s" : ""}`}
          />
        )}
        <Tile
          label="Net cumulé"
          value={net}
          signed
          meta={`sur ${flows.length} mois`}
        />
      </div>
    </>
  );
}
