import type { Snapshot, Goal, WidgetSize, Due } from "./types";
import { balanceAt, dateLabel, euro, today } from "./domain";
import { balanceCoverage, checkpointForDate } from "./coverage";
import { GoalIdentity } from "./GoalIdentity";
import type { weeklyPlan } from "./forecasting";
import "./native-insights.css";

const detailCount = (size: WidgetSize) =>
  ({ tiny: 1, small: 2, medium: 4, large: 6, xlarge: 8 })[size];
const coverageNames = {
  observed: "Observé à cette date",
  covered: "Relevés complets",
  derived: "Reconstitué · à confirmer",
  incomplete: "Période incomplète",
  unknown: "Couverture à vérifier",
};

export function AccountHealth({
  snapshot: s,
  account,
  cutoff,
  size,
  navigate,
  events = s.dues,
}: {
  snapshot: Snapshot;
  account: string;
  cutoff: string;
  size: WidgetSize;
  navigate?: (page: string) => void;
  events?: Due[];
}) {
  const rows = s.accounts
    .filter((a) => !account || a.id === account)
    .map((a) => {
      const balance = balanceAt(a, s.transactions, cutoff);
      const coverage = balanceCoverage(a, cutoff);
      const anchor = checkpointForDate(a, cutoff);
      const due = events
        .filter(
          (d) =>
            d.account === a.id &&
            !d.transactionId &&
            d.amount < 0 &&
            d.date >= cutoff,
        )
        .toSorted((a, b) => a.date.localeCompare(b.date))[0];
      return {
        a,
        balance,
        coverage,
        anchor,
        due,
        needsReview:
          balance === null || !["observed", "covered"].includes(coverage),
      };
    })
    .sort(
      (a, b) =>
        Number(b.balance !== null && b.balance < 0) -
          Number(a.balance !== null && a.balance < 0) ||
        Number(b.needsReview) - Number(a.needsReview),
    );
  return (
    <div className="account-health">
      <div className="health-summary">
        <strong>
          {rows.filter((r) => r.balance !== null && r.balance < 0).length}
        </strong>
        <span>compte(s) à découvert</span>
        <strong>{rows.filter((r) => r.needsReview).length}</strong>
        <span>à vérifier</span>
      </div>
      <ul>
        {rows
          .slice(0, detailCount(size))
          .map(({ a, balance, coverage, anchor, due, needsReview }) => (
            <li
              key={a.id}
              data-state={
                balance !== null && balance < 0
                  ? "risk"
                  : needsReview
                    ? "review"
                    : "ready"
              }
            >
              <div>
                <b>{a.id}</b>
                <strong>
                  {balance === null ? "Solde inconnu" : euro(balance)}
                </strong>
              </div>
              <p className="health-state">
                {balance !== null && balance < 0
                  ? `Découvert à couvrir : ${euro(-balance)}`
                  : coverageNames[coverage]}
              </p>
              {size !== "small" && (
                <small>
                  {anchor
                    ? `Référence : ${dateLabel(anchor.date)}${anchor.status === "derived" ? " · reconstruite" : " · observée"}`
                    : "Aucun solde de référence enregistré."}
                </small>
              )}
              {(size === "large" || size === "xlarge") && due && (
                <p className="health-next">
                  Prochaine sortie · {dateLabel(due.date)}
                  <br />
                  {due.label} <b>{euro(due.amount)}</b>
                  {due.id.startsWith("known:")
                    ? " · importée"
                    : due.estimated
                      ? " · estimée"
                      : ""}
                </p>
              )}
            </li>
          ))}
      </ul>
      {rows.length > detailCount(size) && (
        <small>
          {detailCount(size)} sur {rows.length} comptes, priorités en premier.
        </small>
      )}
      <a
        className="text-button"
        href="#accounts"
        onClick={(event) => {
          if (navigate) {
            event.preventDefault();
            navigate("accounts");
          }
        }}
      >
        Vérifier les soldes de référence ↗
      </a>
    </div>
  );
}

export function GoalHorizon({
  goals,
  size,
  edit,
}: {
  goals: Goal[];
  size: WidgetSize;
  edit: () => void;
}) {
  const asOf = today();
  const rows = goals.map((goal) => {
    const remaining = Math.max(0, goal.target - goal.saved);
    const months =
      remaining === 0
        ? 0
        : (goal.monthly ?? 0) > 0
          ? Math.ceil(remaining / goal.monthly!)
          : null;
    const date =
      months === null || months > 1200 ? null : new Date(asOf + "T12:00:00Z");
    if (date && months) date.setUTCMonth(date.getUTCMonth() + months, 1);
    const arrival = date?.toISOString().slice(0, 7);
    return { goal, remaining, months, arrival };
  });
  const first = rows[0];
  if (!first)
    return (
      <>
        <p>Aucun projet dans ce périmètre.</p>
        <button className="text-button" onClick={edit}>
          Choisir un projet
        </button>
      </>
    );
  if (size === "tiny")
    return (
      <>
        <strong className="insight-value">
          {first.months === null
            ? "À planifier"
            : first.months === 0
              ? "Financé"
              : `${first.months} mois`}
        </strong>
        <small>{first.goal.name}</small>
      </>
    );
  const maxMonths = Math.max(1, ...rows.map((r) => r.months ?? 0));
  return (
    <div className="goal-horizon">
      <p>À effort mensuel constant, dès aujourd’hui</p>
      {size !== "small" && (
        <small>Échelle commune : aujourd’hui → {maxMonths} mois</small>
      )}
      <ol>
        {rows
          .slice(0, detailCount(size))
          .map(({ goal, remaining, months, arrival }, index) => (
            <li key={`${goal.name}-${index}`}>
              <header>
                <GoalIdentity goal={goal} />
                <b>{goal.name}</b>
                <strong>
                  {months === null
                    ? "Effort à définir"
                    : months === 0
                      ? "Financé"
                      : !arrival
                        ? `${months} mois · horizon lointain`
                        : new Intl.DateTimeFormat("fr-FR", {
                            month: "short",
                            year: "numeric",
                          }).format(new Date(arrival + "-01T12:00:00Z"))}
                </strong>
              </header>
              {size !== "small" && (
                <div className="horizon-track" aria-hidden="true">
                  <span
                    style={{
                      width: `${months === null ? 0 : (months / maxMonths) * 100}%`,
                    }}
                  />
                  <i />
                </div>
              )}
              <div className="horizon-detail">
                <span>{euro(remaining)} à financer</span>
                <b>{euro(goal.monthly ?? 0)} / mois</b>
              </div>
              {(size === "large" || size === "xlarge") && (
                <p>
                  {goal.deadline
                    ? `Échéance souhaitée : ${dateLabel(goal.deadline)}${remaining > 0 && ((months !== null && months > 1200) || (arrival && arrival > goal.deadline.slice(0, 7))) ? " · effort insuffisant à ce rythme" : ""}`
                    : "Pas d’échéance imposée"}
                  {size === "xlarge" && months !== null
                    ? ` · ${months} versement(s) estimé(s)`
                    : ""}
                </p>
              )}
            </li>
          ))}
      </ol>
      {rows.length > detailCount(size) && (
        <small>
          {detailCount(size)} sur {rows.length} projets · ordre de priorité
        </small>
      )}
      <small>
        Estimation en mois, sans intérêts ni rendement. Un versement par mois ;
        pas une date d’achat garantie.
      </small>
      <button className="text-button" onClick={edit}>
        Ajuster les contributions ↗
      </button>
    </div>
  );
}

export function SafetyThreshold({
  minimum,
  balance,
  low,
  size,
  navigate,
}: {
  minimum: number;
  balance: number | null;
  low?: { value: number; date: string };
  size: WidgetSize;
  navigate?: (page: string) => void;
}) {
  if (size === "tiny")
    return (
      <>
        <strong className="insight-value">{euro(minimum)}</strong>
        <small>Minimum protégé pour le foyer</small>
      </>
    );
  if (balance === null)
    return (
      <div className="safety-threshold">
        <strong className="insight-value">Solde à confirmer</strong>
        <p>
          Le minimum de {euro(minimum)} est défini, mais sa couverture est
          inconnue.
        </p>
        <p>
          Confirmez le solde de chaque compte du foyer pour mesurer la marge de
          sécurité.
        </p>
        <a
          className="text-button"
          href="#accounts"
          onClick={(event) => {
            if (navigate) {
              event.preventDefault();
              navigate("accounts");
            }
          }}
        >
          Vérifier les soldes ↗
        </a>
      </div>
    );
  const scale = Math.max(1, minimum, balance, low?.value ?? 0);
  const position = (n: number) =>
    `${Math.max(0, Math.min(100, (n / scale) * 100))}%`;
  return (
    <div className="safety-threshold">
      <strong className="insight-value">
        {balance === null ? "Solde à confirmer" : euro(balance - minimum)}
      </strong>
      <p>
        {balance !== null && balance < minimum
          ? "Manque pour retrouver le minimum"
          : "Marge au-dessus du minimum protégé"}
      </p>
      <div
        className="threshold-track"
        role="img"
        aria-label={`Minimum ${euro(minimum)}, solde ${balance === null ? "inconnu" : euro(balance)}`}
      >
        <span style={{ width: position(balance ?? 0) }} />
        <i style={{ left: position(minimum) }} />
      </div>
      <div className="threshold-key">
        <span>
          Minimum <b>{euro(minimum)}</b>
        </span>
        <span>
          Solde <b>{balance === null ? "Inconnu" : euro(balance)}</b>
        </span>
      </div>
      {(size === "large" || size === "xlarge") && low && (
        <div className="threshold-outlook">
          <span>Point bas prévisionnel · {dateLabel(low.date)}</span>
          <strong>{euro(low.value - minimum)} de marge</strong>
          <small>
            {low.value < minimum
              ? "Le minimum serait franchi selon les mouvements connus."
              : "Minimum maintenu selon la prévision partielle."}
          </small>
        </div>
      )}
      {size === "xlarge" && (
        <small>
          Le minimum est une réserve, pas une sortie d’argent. Il ne modifie pas
          le solde bancaire.
        </small>
      )}
    </div>
  );
}

export function WeeklyEnvelopes({
  week,
  size,
}: {
  week: ReturnType<typeof weeklyPlan>;
  size: WidgetSize;
}) {
  if (week.capacity === null || week.status === "unconfigured") return null;
  return (
    <div className="weekly-envelopes">
      <div className="weekly-columns">
        <span>Catégorie</span>
        <span>Payé</span>
        <span>Encore possible</span>
      </div>
      {week.rows.slice(0, detailCount(size)).map((row) => (
        <div className="weekly-envelope" key={row.category}>
          <b>{row.category}</b>
          <span>{euro(row.spent)}</span>
          <strong>{euro(row.limit)}</strong>
          {(size === "large" || size === "xlarge") && (
            <small>
              {euro(row.committed)} à payer · cible {euro(row.target)}
              {size === "xlarge"
                ? ` · habitude ${euro(row.average)} / semaine`
                : ""}
            </small>
          )}
        </div>
      ))}
      {week.rows.length > detailCount(size) && (
        <small>
          {detailCount(size)} sur {week.rows.length} catégories ; plan complet
          sur Ma semaine.
        </small>
      )}
    </div>
  );
}
