import { hrefFor } from "../../app/router";
import { formatMonth, weekday } from "../../domain/dates";
import { nextIncome } from "../../domain/events";
import { forecast, planningEnd } from "../../domain/forecast";
import type { Ledger } from "../../domain/ledger";
import type { WeekPlan } from "../../domain/week";
import { Badge } from "../../ui/Badge";
import { CardShell } from "../../ui/CardShell";
import { SegmentBar } from "../../ui/charts/SegmentBar";
import { Disclosure } from "../../ui/Disclosure";
import { Money } from "../../ui/Money";
import {
  capacityBinds,
  dayLabel,
  isEstimated,
  planStatus,
  weekLabel,
} from "./weekDates";

export type Tense = "past" | "current" | "future";

const eyebrows: Record<Tense, string> = {
  past: "Semaine passée",
  current: "Cette semaine",
  future: "Semaine à venir",
};

export function WeekHero({
  ledger,
  plan,
  tense,
}: {
  ledger: Ledger;
  plan: WeekPlan;
  tense: Tense;
}) {
  const { totals, assumptions } = plan;
  const unknown = tense !== "past" && assumptions.capacity === null;
  const unlimited = !unknown && totals.limit === 0;
  return (
    <CardShell
      palette="ink"
      motif
      className="week-hero"
      eyebrow={`${eyebrows[tense]} · ${weekLabel(plan.start)}`}
    >
      <div className="week-hero-grid">
        <div className="week-hero-main">
          {tense === "past" ? (
            <PastAmount plan={plan} />
          ) : (
            <>
              <p className="week-hero-amount">
                {unlimited ? (
                  <span className="week-hero-none">Aucune limite</span>
                ) : (
                  <>
                    {tense === "current" && (
                      <span className="week-hero-lead">Encore</span>
                    )}
                    <Money
                      value={unknown ? null : totals.possible}
                      size="hero"
                      tone="none"
                      cents="never"
                      unknownReason="Solde à confirmer"
                    />
                  </>
                )}
              </p>
              <p className="week-hero-sub">
                {unlimited ? (
                  "à fixer par catégorie dans Enveloppes"
                ) : unknown ? (
                  <>
                    Solde à confirmer ·{" "}
                    <a href={hrefFor("import")}>Importer un relevé</a>
                  </>
                ) : tense === "current" ? (
                  weekday(ledger.asOf) === 6 ? (
                    "possibles aujourd’hui"
                  ) : (
                    "d’ici dimanche"
                  )
                ) : (
                  "possibles sur la semaine"
                )}
                {!unlimited && capacityBinds(plan) && (
                  <Badge
                    tone="warning"
                    title="Les charges datées à venir et la réserve limitent ce qui reste dépensable, sous les limites des enveloppes"
                  >
                    limité par la trésorerie
                  </Badge>
                )}
              </p>
            </>
          )}
          <SegmentBar
            label="Enveloppes de la semaine"
            paid={totals.paid}
            committed={totals.committed}
            possible={totals.possible}
          />
        </div>
        <Facts ledger={ledger} plan={plan} tense={tense} />
      </div>
      <Calculation ledger={ledger} plan={plan} tense={tense} />
    </CardShell>
  );
}

/** Only spending in limited categories compares to the plan; fixed charges have no limit. */
function PastAmount({ plan }: { plan: WeekPlan }) {
  const { paid, limit } = plan.totals;
  const planned = plan.envelopes
    .filter((e) => e.limit > 0)
    .reduce((n, e) => n + e.paid, 0);
  const gap = planned - limit;
  return (
    <>
      <p className="week-hero-amount">
        <Money value={paid} size="hero" tone="none" cents="never" />
        <span className="week-hero-lead">dépensés</span>
      </p>
      {limit > 0 && (
        <p className="week-hero-sub">
          dont <Money value={planned} cents="never" tone="none" /> sur un plan
          de <Money value={limit} cents="never" tone="none" />
          <Badge tone={gap > 0 ? "negative" : "positive"}>
            {gap > 0 ? "+" : ""}
            <Money value={gap} cents="never" tone="none" />{" "}
            {gap > 0 ? "au-dessus" : "sous le plan"}
          </Badge>
        </p>
      )}
    </>
  );
}

function Facts({
  ledger,
  plan,
  tense,
}: {
  ledger: Ledger;
  plan: WeekPlan;
  tense: Tense;
}) {
  const reserve = plan.assumptions.reserve;
  if (tense === "past") {
    const sunday = plan.days.at(-1)?.endBalance ?? null;
    return (
      <dl className="week-facts">
        <div className="week-fact">
          <dt>Solde dimanche</dt>
          <dd>
            <Money value={sunday} size="m" tone="none" cents="never" />
          </dd>
        </div>
      </dl>
    );
  }
  const low = plan.lowPoint;
  // A lower point after Sunday (next charges before the next income) also caps the week.
  const later = forecast(ledger, plan.account, planningEnd(ledger, plan.end)).lowPoint;
  const after =
    later && later.date > plan.end && (!low || later.value < low.value)
      ? later
      : null;
  const incomes = plan.days
    .flatMap((d) => d.incomes)
    .filter((o) => !o.internal);
  const next = incomes.length ? null : nextIncome(ledger, plan.account);
  return (
    <dl className="week-facts">
      <div className="week-fact" data-alert={low && low.value < reserve ? true : undefined}>
        <dt>Point bas{low ? ` · ${dayLabel(low.date)}` : ""}</dt>
        <dd>
          <Money value={low?.value ?? null} size="m" cents="never" unknownReason="Solde à confirmer" />
          <span className="week-fact-meta">
            réserve <Money value={reserve} cents="never" tone="none" />
            {low && low.value < reserve && (
              <Badge tone="negative">sous la réserve</Badge>
            )}
          </span>
        </dd>
      </div>
      {incomes.map((o) => (
        <div className="week-fact" key={o.id}>
          <dt>{o.label}</dt>
          <dd>
            <Money value={o.amount} size="m" cents="never" tone="none" signed />
            <span className="week-fact-meta">
              {o.overdue ? (
                <Badge tone="warning" title="Revenu daté avant aujourd’hui, pas encore sur le compte : jamais compté">
                  attendu, pas encore reçu
                </Badge>
              ) : (
                <>
                  attendu {dayLabel(o.date)}
                  <Badge
                    tone="estimated"
                    title="Un revenu à venir ne finance pas les dépenses de la semaine"
                  >
                    {isEstimated(o) ? "estimé · non compté" : "non compté"}
                  </Badge>
                </>
              )}
            </span>
          </dd>
        </div>
      ))}
      {after && (
        <div className="week-fact" data-alert={after.value < reserve ? true : undefined}>
          <dt>Point bas suivant · {dayLabel(after.date)}</dt>
          <dd>
            <Money value={after.value} size="m" cents="never" />
            <span className="week-fact-meta">
              après dimanche
              {after.value < reserve && <Badge tone="negative">sous la réserve</Badge>}
            </span>
          </dd>
        </div>
      )}
      {next && (
        <div className="week-fact">
          <dt>Prochain revenu</dt>
          <dd>
            <Money value={next.amount} size="m" cents="never" tone="none" signed />
            <span className="week-fact-meta">
              {next.label} · {dayLabel(next.date)}
            </span>
          </dd>
        </div>
      )}
    </dl>
  );
}

const statusLabel: Record<WeekPlan["assumptions"]["status"], string> = {
  confirmed: "plan enregistré",
  estimated: "estimation",
  unconfigured: "historique insuffisant",
};

function Calculation({
  ledger,
  plan,
  tense,
}: {
  ledger: Ledger;
  plan: WeekPlan;
  tense: Tense;
}) {
  const a = plan.assumptions;
  const projects = plan.account ? 0 : ledger.prefs.projectsReserve;
  const year = ledger.asOf.slice(0, 4);
  return (
    <Disclosure summary="Voir le calcul" className="week-calc">
      <dl className="week-calc-list">
        <div>
          <dt>Limites proposées</dt>
          <dd>
            médiane de {a.weeks} semaine{a.weeks > 1 ? "s" : ""} comparable
            {a.weeks > 1 ? "s" : ""}
            {a.verifiedWeeks > 0 && a.verifiedWeeks === a.weeks
              ? " (relevés complets)"
              : a.verifiedWeeks > 0
                ? ` dont ${a.verifiedWeeks} vérifiées`
                : ""}{" "}
            · {statusLabel[planStatus(plan)]}
          </dd>
        </div>
        {tense !== "past" && (
          <>
            <div>
              <dt>Mois budgétaires traversés</dt>
              <dd>
                {a.months.map((m) => formatMonth(m, year)).join(" + ") || "—"}
                {a.months.length > 1 && " · chaque mois finance ses jours"}
              </dd>
            </div>
            <div>
              <dt>Engagements datés</dt>
              <dd>
                <Money value={plan.totals.committed} tone="none" /> comptés
                une fois, à leur date
              </dd>
            </div>
            <div>
              <dt>Capacité de la trésorerie</dt>
              <dd>
                <Money
                  value={a.capacity}
                  tone="none"
                  unknownReason="Solde à confirmer"
                />{" "}
                · point bas prudent des charges datées − réserve
                {capacityBinds(plan) && (
                  <Badge tone="warning">limite atteinte</Badge>
                )}
              </dd>
            </div>
          </>
        )}
        <div>
          <dt>Réserve protégée</dt>
          <dd>
            <Money value={a.reserve} tone="none" />
            {projects > 0 && (
              <>
                {" "}
                · dont projets <Money value={projects} tone="none" />
              </>
            )}
          </dd>
        </div>
        {tense !== "past" && (
          <div>
            <dt>Possible</dt>
            <dd>
              <Money value={plan.totals.possible} tone="none" /> = limites
              restantes, plafonnées par les enveloppes du mois et la capacité
            </dd>
          </div>
        )}
      </dl>
    </Disclosure>
  );
}
