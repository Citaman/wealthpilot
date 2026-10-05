import { ChevronDown } from "lucide-react";
import { useId, useState, type CSSProperties } from "react";
import { navigate } from "../../../app/router";
import {
  spendingByCategory,
  type CategorySpending,
} from "../../../domain/analytics";
import { categoryColor, OTHERS_COLOR } from "../../../domain/categories";
import type { DateRange } from "../../../domain/dates";
import type { Ledger } from "../../../domain/ledger";
import { formatEuro } from "../../../domain/money";
import {
  filterTransactions,
  summarize,
  type TransactionFilters,
} from "../../../domain/search";
import { Badge } from "../../../ui/Badge";
import { CardShell, useCardWidth } from "../../../ui/CardShell";
import { CategoryDot } from "../../../ui/CategoryDot";
import { Empty } from "../../../ui/Empty";
import { Money } from "../../../ui/Money";
import { acctParam, FooterTile } from "./cardParts";
import type { CardProps } from "./types";
import "./SpendingCard.css";

const LIMIT = { narrow: 5, medium: 8, wide: Infinity } as const;
const UNUSUAL = 25;
const OTHERS = "Autres";

const percent = (share: number) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(share * 100)} %`;

const expenses = (
  account: string,
  range: DateRange,
  categories: string[] = [],
): TransactionFilters => ({
  account,
  range,
  kind: "expense",
  categories,
  min: null,
  max: null,
  uncategorized: false,
  withNote: false,
  query: "",
  sort: "amount-desc",
});

export function SpendingCard({ card, ledger, account, range }: CardProps) {
  const period = { from: range.from, to: range.to };
  const rows = spendingByCategory(ledger, {
    account,
    range: period,
    asOf: ledger.asOf,
  });
  const total = summarize(
    filterTransactions(ledger, expenses(account, period)),
    ledger.asOf,
  ).spending;
  return (
    <CardShell
      palette={card.palette}
      title="Où part l’argent"
      actions={<span className="eyebrow muted">{range.label}</span>}
      footer={rows.length > 0 && <FooterTile value={total} label="dépensés" />}
    >
      {rows.length ? (
        <Ranking ledger={ledger} account={account} range={period} rows={rows} />
      ) : (
        <Empty>Aucune dépense sur la période</Empty>
      )}
    </CardShell>
  );
}

interface Bar {
  key: string;
  amount: number;
  share: number;
  usual: number | null;
  deltaPct: number | null;
  color: string;
}

function Ranking({
  ledger,
  account,
  range,
  rows,
}: {
  ledger: Ledger;
  account: string;
  range: DateRange;
  rows: CategorySpending[];
}) {
  const { size } = useCardWidth();
  const [expanded, setExpanded] = useState<string | null>(null);
  const limit = LIMIT[size];
  const head = rows.length > limit ? rows.slice(0, limit) : rows;
  const rest = rows.slice(head.length);
  const bars: Bar[] = head.map((r) => ({
    key: r.category,
    amount: r.amount,
    share: r.share,
    usual: r.usual,
    deltaPct: r.deltaPct,
    color: categoryColor(r.category, ledger.prefs.categoryDefinitions),
  }));
  if (rest.length)
    bars.push({
      key: OTHERS,
      amount: rest.reduce((n, r) => n + r.amount, 0),
      share: rest.reduce((n, r) => n + r.share, 0),
      usual: null,
      deltaPct: null,
      color: OTHERS_COLOR,
    });
  const max = Math.max(1, ...bars.map((b) => Math.max(b.amount, b.usual ?? 0)));
  const drill = (category: string) =>
    navigate("transactions", {
      cat: category,
      from: range.from,
      to: range.to,
      acct: acctParam(account),
    });

  const split = new Map(
    bars.map((bar) => [
      bar.key,
      size === "wide" && bar.key !== OTHERS
        ? subcategories(ledger, account, range, bar.key)
        : [],
    ]),
  );
  const expandable = [...split.values()].some((s) => s.length > 0);

  return (
    <ol
      className="rank"
      aria-label="Dépenses par catégorie"
      data-size={size}
      data-expandable={expandable || undefined}
    >
      {bars.map((bar) => (
        <Row
          key={bar.key}
          bar={bar}
          max={max}
          size={size}
          expandable={expandable}
          subs={split.get(bar.key) ?? []}
          open={expanded === bar.key}
          onToggle={() => setExpanded(expanded === bar.key ? null : bar.key)}
          onDrill={bar.key === OTHERS ? undefined : () => drill(bar.key)}
        />
      ))}
    </ol>
  );
}

/** Spending of one category split by subcategory (domain totals per group). */
function subcategories(
  ledger: Ledger,
  account: string,
  range: DateRange,
  category: string,
) {
  const groups = new Map<string, ReturnType<typeof filterTransactions>>();
  for (const t of filterTransactions(
    ledger,
    expenses(account, range, [category]),
  )) {
    const key = t.subcategory?.trim() || "";
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  if (groups.size < 2 && groups.has("")) return [];
  return [...groups]
    .map(([name, list]) => ({
      name: name || "Sans sous-catégorie",
      amount: summarize(list, ledger.asOf).spending,
    }))
    .filter((s) => s.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

function Row({
  bar,
  max,
  size,
  expandable,
  subs,
  open,
  onToggle,
  onDrill,
}: {
  bar: Bar;
  max: number;
  size: "narrow" | "medium" | "wide";
  expandable: boolean;
  subs: { name: string; amount: number }[];
  open: boolean;
  onToggle(): void;
  onDrill?: () => void;
}) {
  const panel = useId();
  const unusual = bar.deltaPct !== null && bar.deltaPct > UNUSUAL;
  const style = { "--bar": bar.color } as CSSProperties;
  return (
    <li className="rank-row" style={style} data-open={open || undefined}>
      <span className="rank-head">
        {subs.length > 0 ? (
          <button
            type="button"
            className="rank-toggle"
            aria-expanded={open}
            aria-controls={panel}
            aria-label={`Sous-catégories de ${bar.key}`}
            onClick={onToggle}
          >
            <ChevronDown size={16} aria-hidden />
          </button>
        ) : (
          expandable && <span className="rank-toggle" aria-hidden />
        )}
        <CategoryDot color={bar.color} size={10} />
        {onDrill ? (
          <button
            type="button"
            className="card-link rank-name"
            onClick={onDrill}
            title={`Voir les opérations ${bar.key}`}
          >
            {bar.key}
          </button>
        ) : (
          <span className="rank-name">{bar.key}</span>
        )}
        {unusual && (
          <Badge
            tone="warning"
            title={`Habitude ${formatEuro(bar.usual ?? 0)} (médiane des 3 mois précédents)`}
          >
            +{bar.deltaPct} %{size === "narrow" ? "" : " vs habitude"}
          </Badge>
        )}
        <Money
          className="rank-amount"
          value={bar.amount}
          size="s"
          tone="none"
          cents="never"
        />
        <span className="rank-share mono">{percent(bar.share)}</span>
        {size === "wide" && (
          <span className="rank-usual mono muted">
            {bar.usual !== null
              ? `hab. ${formatEuro(bar.usual, { cents: "never" })}`
              : ""}
          </span>
        )}
      </span>
      <span className="rank-track" aria-hidden>
        <span
          className="rank-fill"
          style={{ width: `${(bar.amount / max) * 100}%` }}
        />
        {bar.usual !== null && (
          <span
            className="rank-tick"
            style={{ left: `${(bar.usual / max) * 100}%` }}
          />
        )}
      </span>
      {subs.length > 0 && (
        <ul id={panel} className="rank-subs" hidden={!open}>
          {subs.map((s) => (
            <li key={s.name}>
              <span className="rank-sub-name">{s.name}</span>
              <span className="rank-sub-track" aria-hidden>
                <span style={{ width: `${(s.amount / bar.amount) * 100}%` }} />
              </span>
              <Money value={s.amount} tone="none" cents="never" />
              <span className="mono muted rank-share">
                {percent(s.amount / bar.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
