import type { CSSProperties } from "react";
import { navigate } from "../../../app/router";
import {
  spendingByCategory,
  spendingBySubcategory,
  type CategorySpending,
  type SubcategorySpending,
} from "../../../domain/analytics";
import { categoryColor, OTHERS_COLOR } from "../../../domain/categories";
import type { DateRange } from "../../../domain/dates";
import type { Ledger } from "../../../domain/ledger";
import { formatEuro } from "../../../domain/money";
import {
  filterTransactions,
  NO_SUBCATEGORY,
  subcategoryKey,
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

const expenses = (account: string, range: DateRange): TransactionFilters => ({
  account,
  range,
  kind: "expense",
  categories: [],
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
  subs: SubcategorySpending[];
}

/** Subcategory segments of a bar, darkest first; the rest folds into the last shade. */
const SHADES = [100, 68, 44, 26];

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
  const limit = LIMIT[size];
  const head = rows.length > limit ? rows.slice(0, limit) : rows;
  const rest = rows.slice(head.length);
  const split = spendingBySubcategory(ledger, {
    account,
    range,
    asOf: ledger.asOf,
  });
  const bars: Bar[] = head.map((r) => ({
    key: r.category,
    amount: r.amount,
    share: r.share,
    usual: r.usual,
    deltaPct: r.deltaPct,
    color: categoryColor(r.category, ledger.prefs.categoryDefinitions),
    subs: split.get(r.category) ?? [],
  }));
  if (rest.length)
    bars.push({
      key: OTHERS,
      amount: rest.reduce((n, r) => n + r.amount, 0),
      share: rest.reduce((n, r) => n + r.share, 0),
      usual: null,
      deltaPct: null,
      color: OTHERS_COLOR,
      subs: [],
    });
  const max = Math.max(1, ...bars.map((b) => Math.max(b.amount, b.usual ?? 0)));
  const drill = (category: string, subcategory?: string) =>
    navigate("transactions", {
      cat: subcategoryKey(category, subcategory),
      from: range.from,
      to: range.to,
      acct: acctParam(account),
    });

  return (
    <ol className="rank" aria-label="Dépenses par catégorie" data-size={size}>
      {bars.map((bar) => (
        <Row
          key={bar.key}
          bar={bar}
          max={max}
          size={size}
          onDrill={bar.key === OTHERS ? undefined : drill}
        />
      ))}
    </ol>
  );
}

function Row({
  bar,
  max,
  size,
  onDrill,
}: {
  bar: Bar;
  max: number;
  size: "narrow" | "medium" | "wide";
  onDrill?: (category: string, subcategory?: string) => void;
}) {
  const unusual = bar.deltaPct !== null && bar.deltaPct > UNUSUAL;
  const style = { "--bar": bar.color } as CSSProperties;
  const named = bar.subs.some((s) => s.subcategory);
  const segments = named
    ? [
        ...bar.subs.slice(0, SHADES.length - 1),
        ...(bar.subs.length >= SHADES.length
          ? [
              {
                subcategory: "",
                amount: bar.subs
                  .slice(SHADES.length - 1)
                  .reduce((n, s) => n + s.amount, 0),
              },
            ]
          : []),
      ]
    : [];
  const listed =
    size === "narrow" ? bar.subs.slice(0, 1) : bar.subs.slice(0, 4);
  return (
    <li className="rank-row" style={style}>
      <span className="rank-head">
        <CategoryDot color={bar.color} size={10} />
        {onDrill ? (
          <button
            type="button"
            className="card-link rank-name"
            onClick={() => onDrill(bar.key)}
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
        >
          {segments.map((s, i) => (
            <span
              key={s.subcategory || i}
              style={
                {
                  flexGrow: s.amount,
                  "--shade": `${SHADES[i]}%`,
                } as CSSProperties
              }
            />
          ))}
        </span>
        {bar.usual !== null && (
          <span
            className="rank-tick"
            style={{ left: `${(bar.usual / max) * 100}%` }}
          />
        )}
      </span>
      {named && (
        <ul className="rank-subs" aria-label={`${bar.key} par sous-catégorie`}>
          {listed.map((s, i) => (
            <li key={s.subcategory || "none"}>
              <button
                type="button"
                className="rank-sub"
                style={
                  {
                    "--shade": `${SHADES[Math.min(i, SHADES.length - 1)]}%`,
                  } as CSSProperties
                }
                onClick={() =>
                  onDrill?.(bar.key, s.subcategory || NO_SUBCATEGORY)
                }
                title={`Voir les opérations ${bar.key} › ${s.subcategory || "sans sous-catégorie"}`}
              >
                <span className="rank-sub-name">
                  {s.subcategory || "Autres"}
                </span>
                <Money value={s.amount} tone="none" cents="never" />
              </button>
            </li>
          ))}
          {bar.subs.length > listed.length && size !== "narrow" && (
            <li className="rank-sub-more mono muted">
              +{bar.subs.length - listed.length}
            </li>
          )}
        </ul>
      )}
    </li>
  );
}
