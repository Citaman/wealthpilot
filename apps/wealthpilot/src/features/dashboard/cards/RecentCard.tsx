import { ArrowRight } from "lucide-react";
import { navigate } from "../../../app/router";
import { categoryColor, isUncategorized } from "../../../domain/categories";
import { formatWeekday } from "../../../domain/dates";
import { accountName, type Ledger } from "../../../domain/ledger";
import {
  filterTransactions,
  merchantLabel,
  summarize,
} from "../../../domain/search";
import type { IsoDate, Transaction } from "../../../domain/types";
import { Button } from "../../../ui/Button";
import { CardShell, useCardWidth } from "../../../ui/CardShell";
import { CategoryDot } from "../../../ui/CategoryDot";
import { Empty } from "../../../ui/Empty";
import { Money } from "../../../ui/Money";
import { acctParam, Logo } from "./cardParts";
import type { CardProps } from "./types";
import "./RecentCard.css";

/** Rows per measured width: 8 at ⅓, 12 at ½, 15 at ⅔ and full. */
const countFor = (width: number) => (width < 520 ? 6 : width < 800 ? 8 : 10);

export function RecentCard({ card, ledger, account, range }: CardProps) {
  // Future-dated imports belong to « À venir », not to what happened.
  const rows = filterTransactions(ledger, {
    account,
    range: { from: range.from, to: range.to },
    kind: "all",
    categories: [],
    min: null,
    max: null,
    uncategorized: false,
    withNote: false,
    query: "",
    sort: "date-desc",
  }).filter((t) => t.date <= ledger.asOf);
  return (
    <CardShell
      palette={card.palette}
      title="Opérations"
      actions={<span className="eyebrow muted">{range.label}</span>}
      footer={
        rows.length > 0 && (
          <div className="recent-foot">
            <Button
              variant="outline"
              iconEnd={<ArrowRight />}
              onClick={() =>
                navigate("transactions", {
                  from: range.from,
                  to: range.to,
                  acct: acctParam(account),
                })
              }
            >
              Tout voir ({rows.length})
            </Button>
          </div>
        )
      }
    >
      {rows.length ? (
        <Days ledger={ledger} rows={rows} account={account} />
      ) : (
        <Empty>Aucune opération sur la période</Empty>
      )}
    </CardShell>
  );
}

function Days({
  ledger,
  rows,
  account,
}: {
  ledger: Ledger;
  rows: Transaction[];
  account: string;
}) {
  const { width, size } = useCardWidth();
  const days = new Map<IsoDate, Transaction[]>();
  for (const t of rows.slice(0, countFor(width)))
    days.set(t.date, [...(days.get(t.date) ?? []), t]);
  const wide = size === "wide";
  return (
    <div className="recent" data-size={size}>
      {[...days].map(([date, list]) => {
        const net = list.every((t) => t.internal)
          ? null
          : summarize(list, ledger.asOf).net;
        return (
          <section
            key={date}
            className="recent-day"
            aria-label={formatWeekday(date)}
          >
            <h3 className="recent-day-head">
              <span className="mono recent-date">{formatWeekday(date)}</span>
              {net !== null && (
                <Money
                  className="mono"
                  value={net}
                  signed
                  tone="none"
                  title="Net du jour, virements internes exclus"
                />
              )}
            </h3>
            <ul className="recent-rows">
              {list.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className="recent-row"
                    data-internal={t.internal || undefined}
                    onClick={() => navigate("transactions", { tx: t.id })}
                  >
                    <Logo
                      ledger={ledger}
                      name={merchantLabel(t)}
                      category={t.category}
                      size={28}
                    />
                    <span className="recent-text">
                      <span className="recent-name">{merchantLabel(t)}</span>
                      {!wide && (
                        <span className="recent-meta mono">
                          {[
                            isUncategorized(t.category)
                              ? "À catégoriser"
                              : t.category,
                            !account && accountName(ledger, t.account),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                    </span>
                    {wide && (
                      <>
                        <span className="recent-category">
                          <CategoryDot
                            color={categoryColor(
                              t.category,
                              ledger.prefs.categoryDefinitions,
                            )}
                          />
                          <span>
                            {isUncategorized(t.category)
                              ? "À catégoriser"
                              : t.category}
                          </span>
                        </span>
                        <span className="recent-account mono">
                          {accountName(ledger, t.account)}
                        </span>
                      </>
                    )}
                    <Money
                      className="recent-amount"
                      value={t.amount}
                      signed
                      tone={t.amount > 0 && !t.internal ? "auto" : "none"}
                    />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
