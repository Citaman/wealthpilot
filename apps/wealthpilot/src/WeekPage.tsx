import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { Snapshot } from "./types";
import {
  addDays,
  dateLabel,
  euro,
  parseMoney,
  today,
  weekStart,
} from "./domain";
import { weeklyPlan, simulatePurchase } from "./forecasting";
import { db } from "./store";
import { Field, Notice } from "./ui";
import { Select } from "./Select";
import { PageActions } from "./PageActions";
import "./week.css";
import { useCurrentDate } from "./useCurrentDate";

export function PurchaseTool({
  snapshot,
  account = "",
  initialDate = today(),
  initialCategory = "",
}: {
  snapshot: Snapshot;
  account?: string;
  initialDate?: string;
  initialCategory?: string;
}) {
  const asOf = useCurrentDate();
  const [question, setQuestion] = useState(""),
    [amount, setAmount] = useState(""),
    [category, setCategory] = useState(initialCategory),
    [payer, setPayer] = useState(
      account ||
        (snapshot.accounts.length === 1 ? snapshot.accounts[0].id : ""),
    ),
    [date, setDate] = useState(initialDate < asOf ? asOf : initialDate),
    [included, setIncluded] = useState(true),
    [confirmed, setConfirmed] = useState(false),
    [hint, setHint] = useState("");
  const effectivePayer = payer || account;
  const categories = [
    ...new Set([
      ...snapshot.transactions
        .filter((t) => t.amount < 0 && !t.internal)
        .map((t) => t.category),
      ...snapshot.budgets.map((b) => b.category),
      ...(snapshot.preferences.weeklyPlans ?? []).flatMap((p) =>
        Object.keys(p.limits),
      ),
    ]),
  ].sort();
  const cents = parseMoney(amount);
  const result = useMemo(
    () =>
      confirmed &&
      cents !== null &&
      cents > 0 &&
      effectivePayer &&
      category &&
      date >= asOf
        ? simulatePurchase(
            snapshot,
            {
              amount: cents,
              category,
              date,
              account: effectivePayer,
              included,
            },
            asOf,
          )
        : null,
    [
      confirmed,
      cents,
      effectivePayer,
      category,
      date,
      included,
      snapshot,
      asOf,
    ],
  );
  function interpret() {
    const match = question.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?)/i);
    if (match) setAmount(match[1].replace(",", "."));
    const found = categories.filter((c) =>
      question.toLocaleLowerCase("fr").includes(c.toLocaleLowerCase("fr")),
    );
    if (found.length === 1) setCategory(found[0]);
    if (/demain/i.test(question)) setDate(addDays(asOf, 1));
    else if (/aujourd|ce soir/i.test(question)) setDate(asOf);
    setConfirmed(false);
    setHint(
      "Préremplissage local uniquement. Vérifiez le montant, la catégorie, la date et le compte avant de simuler.",
    );
  }
  return (
    <div className="purchase-tool">
      <details className="purchase-question">
        <summary>
          Décrire mon achat en une phrase <ChevronDown size={14} />
        </summary>
        <Field label="Votre question">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Puis-je dépenser 35 € en Courses demain ?"
          />
        </Field>
        <button className="text-button" onClick={interpret}>
          Préremplir les champs
        </button>
        {hint && <p role="status">{hint}</p>}
      </details>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setConfirmed(true);
        }}
      >
        <div className="form-grid">
          <Field label="Montant (€)">
            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setConfirmed(false);
              }}
            />
          </Field>
          <Field label="Catégorie">
            <Select
              required
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setConfirmed(false);
              }}
            >
              <option value="">Choisir</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Compte payeur">
            <Select
              required
              value={effectivePayer}
              onChange={(e) => {
                setPayer(e.target.value);
                setConfirmed(false);
              }}
            >
              <option value="">Choisir le compte</option>
              {snapshot.accounts.map((a) => (
                <option key={a.id}>{a.id}</option>
              ))}
            </Select>
          </Field>
          <Field label="Date prévue">
            <input
              required
              type="date"
              min={asOf}
              max={addDays(asOf, 90)}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setConfirmed(false);
              }}
            />
          </Field>
        </div>
        <label className="check-row">
          <input
            type="checkbox"
            checked={included}
            onChange={(e) => {
              setIncluded(e.target.checked);
              setConfirmed(false);
            }}
          />
          Achat prévu dans l’enveloppe existante
        </label>
        <button className="button yellow" type="submit">
          Confirmer et simuler
        </button>
      </form>
      {result && (
        <section className="simulation-result" aria-live="polite">
          <h3>
            {result.week.status === "unconfigured"
              ? "Plan de semaine à définir avant de conclure"
              : result.shortfall === null
                ? "Solde à confirmer"
                : result.shortfall > 0
                  ? `${euro(result.shortfall)} à libérer ou approvisionner`
                  : "Compatible avec les hypothèses affichées"}
          </h3>
          <dl className="insight-stats">
            <div>
              <dt>Cash du payeur aujourd’hui</dt>
              <dd>{result.cash === null ? "Inconnu" : euro(result.cash)}</dd>
            </div>
            <div>
              <dt>Marge catégorie après achat</dt>
              <dd>{euro(result.remaining)}</dd>
            </div>
            <div>
              <dt>Point bas central avant → après</dt>
              <dd>
                {result.before.low && result.after.low
                  ? `${euro(result.before.low.value)} → ${euro(result.after.low.value)} · ${dateLabel(result.after.low.date)}`
                  : "Inconnu"}
              </dd>
            </div>
          </dl>
          <dl className="insight-stats">
            <div>
              <dt>Point bas prudent du payeur</dt>
              <dd>
                {result.after.prudentLow
                  ? `${euro(result.after.prudentLow.lower)} · ${dateLabel(result.after.prudentLow.date)}`
                  : "Inconnu"}
              </dd>
            </div>
            <div>
              <dt>Effet foyer · point bas avant → après</dt>
              <dd>
                {result.householdBefore.low && result.householdAfter.low
                  ? `${euro(result.householdBefore.low.value)} → ${euro(result.householdAfter.low.value)}`
                  : "Un solde du foyer reste inconnu"}
              </dd>
            </div>
            <div>
              <dt>Horizon contrôlé</dt>
              <dd>{dateLabel(result.after.points.at(-1)?.date ?? date)}</dd>
            </div>
          </dl>
          {result.before.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
          <small>
            Aucune opération ni aucun virement enregistré. Un achat hors
            enveloppe s’ajoute aux provisions ; un achat inclus consomme sa
            provision existante. Les revenus futurs restent hypothétiques.
          </small>
        </section>
      )}
    </div>
  );
}

export function WeekPage({
  snapshot,
  account: contextAccount,
  notify,
}: {
  snapshot: Snapshot;
  account: string;
  notify: (s: string) => void;
}) {
  const asOf = useCurrentDate();
  const [account, setAccount] = useState(contextAccount);
  const [start, setStart] = useState(() => addDays(weekStart(asOf), 7)),
    [reduction, setReduction] = useState(0),
    [editing, setEditing] = useState(false),
    [limits, setLimits] = useState<Record<string, string>>({}),
    [reserve, setReserve] = useState("0"),
    [error, setError] = useState("");
  const [purchase, setPurchase] = useState<string | null>(null);
  const purchasePanel = useRef<HTMLElement>(null);
  const purchaseOpener = useRef<HTMLElement | null>(null);
  const nextWeek = addDays(weekStart(asOf), 7);
  const pendingAccount = contextAccount !== account;
  useEffect(() => {
    if (!editing) setAccount(contextAccount);
  }, [contextAccount, editing]);
  const plan = useMemo(
    () => weeklyPlan(snapshot, start, account, asOf, reduction),
    [snapshot, start, account, reduction, asOf],
  );
  const [pendingStart, setPendingStart] = useState<string | null>(null);
  const upcoming = plan.forecast.events
    .filter((d) => d.date >= start && d.date <= plan.end && !d.internal)
    .sort((a, b) => a.date.localeCompare(b.date));
  const readable = plan.capacity !== null && plan.status !== "unconfigured";
  function openPurchase(category = "") {
    purchaseOpener.current = document.activeElement as HTMLElement;
    setPurchase(category);
    requestAnimationFrame(() => {
      purchasePanel.current?.scrollIntoView({
        block: "nearest",
        behavior: "auto",
      });
      purchasePanel.current
        ?.querySelector<HTMLInputElement>('input[type="number"]')
        ?.focus({ preventScroll: true });
    });
  }
  function closePurchase() {
    setPurchase(null);
    requestAnimationFrame(() => purchaseOpener.current?.focus());
  }
  function showCalculation() {
    const details = document.getElementById(
      "week-calculation",
    ) as HTMLDetailsElement | null;
    if (details) details.open = true;
  }
  function changeWeek(next: string) {
    if (editing) setPendingStart(next);
    else setStart(next);
  }
  const [planRevision, setPlanRevision] = useState("");
  function edit() {
    setPlanRevision(JSON.stringify(plan.saved ?? null));
    setLimits(
      Object.fromEntries(
        plan.rows.map((r) => [r.category, String(r.target / 100)]),
      ),
    );
    setReserve(String(plan.reserve / 100));
    setEditing(true);
    setError("");
  }
  async function save() {
    try {
      if (Object.keys(limits).length > 100)
        throw new Error(
          "Ce plan dépasse 100 catégories. Regroupez les catégories avant d’enregistrer ; aucune limite n’a été supprimée.",
        );
      const values = Object.fromEntries(
        Object.entries(limits).map(([key, value]) => {
          const n = parseMoney(value);
          if (n === null || n < 0) throw new Error("Montant invalide : " + key);
          return [key, n];
        }),
      );
      const protectedAmount = parseMoney(reserve);
      if (protectedAmount === null || protectedAmount < 0)
        throw new Error("Réserve invalide.");
      await db.transaction("rw", db.preferences, async () => {
        const p = (await db.preferences.get("main")) ?? snapshot.preferences;
        if (
          JSON.stringify(
            p.weeklyPlans?.find(
              (p) => p.start === start && p.account === account,
            ) ?? null,
          ) !== planRevision
        )
          throw new Error(
            "Ce plan a changé dans un autre onglet. Annulez puis rouvrez le plan pour comparer les nouvelles valeurs.",
          );
        await db.preferences.put({
          ...p,
          weeklyPlans: [
            ...(p.weeklyPlans ?? []).filter(
              (p) => p.start !== start || p.account !== account,
            ),
            {
              start,
              account,
              limits: values,
              reserve: protectedAmount,
              reduction,
            },
          ].slice(-200),
        });
      });
      setEditing(false);
      notify("Plan de semaine enregistré pour ce périmètre.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <main className="page week-page">
      <h1 className="sr-only">Ma semaine</h1>
      <PageActions page="week">
        <div className="week-navigation">
          <div
            className="segmented"
            role="group"
            aria-label="Choisir la semaine"
          >
            {[0, 1].map((n) => (
              <button
                key={n}
                aria-pressed={start === addDays(weekStart(asOf), n * 7)}
                onClick={() => changeWeek(addDays(weekStart(asOf), n * 7))}
              >
                {n === 0 ? "Cette semaine" : "Prochaine"}
              </button>
            ))}
          </div>
          <details
            className="week-date-picker"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.currentTarget.open = false;
                e.currentTarget.querySelector("summary")?.focus();
              }
            }}
          >
            <summary>
              <CalendarDays size={16} />
              {dateLabel(start)} — {dateLabel(plan.end)}{" "}
              <ChevronDown size={14} />
            </summary>
            <Field label="Semaine du">
              <input
                type="date"
                value={start}
                onChange={(e) => {
                  if (e.target.value) changeWeek(weekStart(e.target.value));
                }}
              />
            </Field>
          </details>
        </div>
      </PageActions>
      {pendingStart && (
        <Notice>
          Ce plan contient des modifications non enregistrées.
          <div className="actions">
            <button className="button" onClick={() => setPendingStart(null)}>
              Continuer à modifier
            </button>
            <button
              className="button"
              onClick={() => {
                setStart(pendingStart);
                setPendingStart(null);
                setEditing(false);
              }}
            >
              Abandonner le brouillon et changer de semaine
            </button>
          </div>
        </Notice>
      )}
      {pendingAccount && editing && (
        <Notice>
          Le filtre global a changé. Ce brouillon concerne toujours{" "}
          {account || "le foyer"} ; il ne sera pas enregistré sur le nouveau
          compte.
          <button
            className="button"
            onClick={() => {
              setEditing(false);
              setAccount(contextAccount);
            }}
          >
            Abandonner ce brouillon et afficher {contextAccount || "le foyer"}
          </button>
        </Notice>
      )}
      <section className="week-overview" aria-label="Votre marge de la semaine">
        <div className="week-hero">
          <span className="eyebrow">
            {start === nextWeek
              ? "POUR LA SEMAINE PROCHAINE"
              : "POUR LA SEMAINE SÉLECTIONNÉE"}
          </span>
          <strong>
            {plan.capacity === null
              ? "Solde à confirmer"
              : plan.status === "unconfigured"
                ? "Plan à définir"
                : euro(plan.remaining)}
          </strong>
          <p>
            {readable
              ? "encore à dépenser, toutes catégories réunies"
              : plan.capacity === null
                ? "Ajoutez un solde confirmé pour connaître votre marge."
                : "Définissez vos enveloppes pour préparer la semaine."}
          </p>
          <span className="week-status">
            {plan.saved ? "Plan enregistré" : "Estimation · à valider"}
          </span>
        </div>
        <div className="week-overview-detail">
          <p>
            Les charges et la réserve sont déjà protégées. Aucun salaire futur
            n’est avancé.
          </p>
          <dl className="week-totals">
            <div>
              <dt>Déjà dépensé</dt>
              <dd>{euro(plan.spent)}</dd>
            </div>
            <div>
              <dt>À payer cette semaine</dt>
              <dd>{euro(plan.committed)}</dd>
            </div>
            <div>
              <dt>Réserve protégée</dt>
              <dd>{euro(plan.reserve)}</dd>
            </div>
          </dl>
          {(plan.overdue > 0 || plan.forecast.warnings.length > 0) && (
            <p className="week-caution">
              {plan.overdue > 0
                ? `${euro(plan.overdue)} d’échéances échues restent à vérifier.`
                : "Historique incomplet : ces montants restent une estimation."}{" "}
              <a href="#week-calculation" onClick={showCalculation}>
                Voir les hypothèses ↓
              </a>
            </p>
          )}
        </div>
      </section>
      <div className="week-workspace">
        <section
          className="week-budget-sheet"
          aria-labelledby="week-envelopes-title"
        >
          <div className="card-heading">
            <div>
              <span className="eyebrow">À DÉPENSER</span>
              <h2 id="week-envelopes-title">Vos enveloppes.</h2>
            </div>
            {!editing && (
              <button className="button" onClick={edit}>
                <SlidersHorizontal size={15} />
                Ajuster ce plan
              </button>
            )}
          </div>
          <p className="week-section-intro">
            {account ? `Pour ${account}.` : "Pour tout le foyer."} Les montants
            ci-dessous se partagent la même marge, ils ne s’y ajoutent pas.
          </p>
          {editing && (
            <div className="week-edit-settings">
              <h3>Ajuster sans perdre le fil</h3>
              <p>
                Vos montants sont des objectifs. La trésorerie et les plafonds
                mensuels limitent toujours ce qui est disponible.
              </p>
              {!plan.saved && (
                <Field label={`Réduction souhaitée : ${reduction} %`}>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={reduction}
                    onChange={(e) => setReduction(Number(e.target.value))}
                  />
                </Field>
              )}
              <Field label="Réserve affectée à ce périmètre (€)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={reserve}
                  onChange={(e) => setReserve(e.target.value)}
                />
              </Field>
            </div>
          )}
          <div className="week-envelopes">
            {plan.rows.map((row) => (
              <article
                key={row.category}
                className={
                  row.limit === 0 ? "week-envelope exhausted" : "week-envelope"
                }
              >
                <div className="week-envelope-heading">
                  <span className="week-category-initial" aria-hidden="true">
                    {row.category.slice(0, 1)}
                  </span>
                  <div>
                    <h3>{row.category}</h3>
                    <small>
                      {row.spent > 0
                        ? `${euro(row.spent)} déjà dépensés`
                        : row.committed > 0
                          ? `${euro(row.committed)} déjà engagés`
                          : "Votre marge pour la semaine"}
                    </small>
                  </div>
                  <div className="week-envelope-value">
                    <strong>{readable ? euro(row.limit) : "—"}</strong>
                    <small>{readable ? "disponibles" : "à définir"}</small>
                  </div>
                </div>
                {editing ? (
                  <Field label={`Objectif ${row.category} (€)`}>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={limits[row.category] ?? "0"}
                      onChange={(e) =>
                        setLimits({ ...limits, [row.category]: e.target.value })
                      }
                    />
                  </Field>
                ) : (
                  <div className="week-envelope-track" aria-hidden="true">
                    <i
                      style={{
                        width: `${row.target > 0 ? Math.min(100, (row.limit / row.target) * 100) : 0}%`,
                      }}
                    />
                  </div>
                )}
                <div className="week-envelope-actions">
                  <details>
                    <summary>
                      Voir le calcul <ChevronDown size={13} />
                    </summary>
                    <dl>
                      <div>
                        <dt>Dépensé</dt>
                        <dd>{euro(row.spent)}</dd>
                      </div>
                      <div>
                        <dt>Engagé</dt>
                        <dd>{euro(row.committed)}</dd>
                      </div>
                      <div>
                        <dt>Encore possible</dt>
                        <dd>{euro(row.limit)}</dd>
                      </div>
                    </dl>
                    {row.monthLimits
                      .filter((m) => m.remaining !== null)
                      .map((m) => (
                        <small key={m.month}>
                          Plafond du cycle restant · {m.month} :{" "}
                          {euro(m.remaining!)}. Part utilisable cette semaine :{" "}
                          {euro(m.allowed)}.
                        </small>
                      ))}
                    <small>
                      Médiane observée : {euro(row.average)} / semaine.
                    </small>
                    {row.target < row.average && (
                      <small>
                        Réduire de {euro(row.average - row.target)} par rapport
                        à la médiane.
                      </small>
                    )}
                  </details>
                  {!editing && (
                    <button
                      className="text-button"
                      onClick={() => openPurchase(row.category)}
                      aria-label={`Tester un achat en ${row.category}`}
                    >
                      <ArrowUpRight size={15} />
                      Tester un achat
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
          {!plan.rows.length && (
            <p>
              Importez un historique ou définissez des budgets pour construire
              les enveloppes.
            </p>
          )}
          {error && <Notice error>{error}</Notice>}
          {editing && (
            <div className="actions week-edit-actions">
              <button className="button yellow" onClick={() => void save()}>
                Enregistrer
              </button>
              <button
                className="button"
                onClick={() => {
                  setEditing(false);
                  setReduction(0);
                }}
              >
                Annuler
              </button>
            </div>
          )}
          <p className="week-source">
            {plan.saved
              ? "Limites choisies par vous."
              : `Proposition issue de ${plan.weeks} semaines observées.`}{" "}
            Les données importées restent inchangées.
          </p>
        </section>
        <aside className="week-side">
          <section
            className="week-purchase"
            ref={purchasePanel}
            aria-labelledby="week-purchase-title"
          >
            <div className="card-heading">
              <h2 id="week-purchase-title">Et si je dépense…</h2>
              {purchase !== null && (
                <button
                  className="icon-button"
                  aria-label="Fermer le simulateur"
                  onClick={closePurchase}
                >
                  <X size={18} />
                </button>
              )}
            </div>
            <p>
              Un resto, une sortie, un achat imprévu ? Vérifiez ce qu’il restera
              avant de décider.
            </p>
            {purchase === null ? (
              <button className="button dark" onClick={() => openPurchase()}>
                Tester un achat <ArrowUpRight size={16} />
              </button>
            ) : (
              <PurchaseTool
                key={account + start + purchase}
                snapshot={snapshot}
                account={account}
                initialDate={start}
                initialCategory={purchase}
              />
            )}
          </section>
          <section
            className="week-upcoming"
            aria-labelledby="week-upcoming-title"
          >
            <span className="eyebrow">
              DU {dateLabel(start)} AU {dateLabel(plan.end)}
            </span>
            <h2 id="week-upcoming-title">Ce qui arrive.</h2>
            {upcoming.length ? (
              <ul>
                {upcoming.slice(0, 4).map((d) => (
                  <li key={d.id}>
                    <span
                      className={`week-event-icon ${d.amount > 0 ? "income" : ""}`}
                      aria-hidden="true"
                    >
                      {d.amount > 0 ? (
                        <ArrowDownRight size={17} />
                      ) : (
                        <ArrowUpRight size={17} />
                      )}
                    </span>
                    <div>
                      <b>{d.label}</b>
                      <small>
                        {dateLabel(d.date)} · {d.estimated ? "Estimé" : "Prévu"}
                      </small>
                    </div>
                    <strong>
                      {d.amount > 0 ? "+" : ""}
                      {euro(d.amount)}
                    </strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                Aucune échéance identifiée sur cette semaine. Cela ne garantit
                pas l’absence de charges.
              </p>
            )}
            {upcoming.length > 4 && (
              <a
                className="text-button"
                href="#week-calculation"
                onClick={showCalculation}
              >
                Voir les {upcoming.length} échéances ↓
              </a>
            )}
          </section>
        </aside>
      </div>
      <details className="week-calculation" id="week-calculation">
        <summary>Hypothèses et échéances du calcul</summary>
        <p>
          {plan.coverage} Les propositions par compte ne sont pas une division
          du budget du foyer.
        </p>
        {plan.forecast.warnings.map((w) => (
          <p key={w}>{w}</p>
        ))}
        {plan.overdue > 0 && (
          <p>
            {euro(plan.overdue)} d’échéances échues non rapprochées restent
            protégés. Vérifiez leur paiement avant de libérer cette somme.
          </p>
        )}
        <p>{plan.forecast.assumptions}</p>
        {plan.forecast.events.map((d) => (
          <p key={d.id}>
            {dateLabel(d.date)} · {d.label} · {euro(d.amount)} ·{" "}
            {d.estimated ? "Estimée" : "Saisie"}
          </p>
        ))}
      </details>
    </main>
  );
}
