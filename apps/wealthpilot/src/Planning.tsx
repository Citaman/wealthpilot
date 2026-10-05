import { useMemo, useState, useEffect, useRef } from "react";
import Dexie from "dexie";
import type { Snapshot, Goal } from "./types";
import {
  allGoals,
  legacyGoalTemplates,
  readLegacyPlan,
  suggestBudgets,
  detectRecurrences,
  mergeLegacyGoals,
  goalRecoverySummary,
} from "./intelligence";
import { euro, parseMoney, today, dateLabel, parseDate } from "./domain";
import { db } from "./store";
import { Field, Notice, InlinePanel } from "./ui";
import { EditorDialog } from "./Editors";
import { GoalRecovery } from "./GoalRecovery";
import {
  GoalIdentity,
  GoalAppearance,
  goalAppearance,
  goalColors,
} from "./GoalIdentity";
import { Select } from "./Select";
import { budgetCalendar, budgetCycleKey } from "./periods";
export function GoalsEditor({
  snapshot,
  notify,
  onClose,
  account = "",
}: {
  snapshot: Snapshot;
  notify: (s: string) => void;
  onClose: () => void;
  account?: string;
}) {
  const [goals, setGoals] = useState<Goal[]>(() =>
      allGoals(snapshot).map((g, i) => ({ ...g, priority: g.priority ?? i })),
    ),
    [error, setError] = useState(""),
    [active, setActive] = useState(() =>
      account ? allGoals(snapshot).findIndex((g) => g.account === account) : 0,
    ),
    [saving, setSaving] = useState(false);
  const initialGoals = useRef(JSON.stringify(allGoals(snapshot)));
  const [removed, setRemoved] = useState<{ goal: Goal; index: number } | null>(
    null,
  );
  const allOrdered = goals
    .map((goal, index) => ({ goal, index }))
    .sort(
      (a, b) => (a.goal.priority ?? a.index) - (b.goal.priority ?? b.index),
    );
  const ordered = allOrdered.filter(
    ({ goal }) => !account || goal.account === account,
  );
  function movePriority(index: number, offset: number) {
    const order = ordered.map((item) => item.index);
    const position = order.indexOf(index),
      next = position + offset;
    if (next < 0 || next >= order.length) return;
    const globalOrder = allOrdered.map((item) => item.index);
    const left = globalOrder.indexOf(order[position]),
      right = globalOrder.indexOf(order[next]);
    [globalOrder[left], globalOrder[right]] = [
      globalOrder[right],
      globalOrder[left],
    ];
    setGoals((gs) =>
      gs.map((g, i) => ({ ...g, priority: globalOrder.indexOf(i) })),
    );
  }
  function change(i: number, key: keyof Goal, value: string) {
    setGoals((gs) =>
      gs.map((g, n) =>
        n === i
          ? {
              ...g,
              [key]: ["name", "icon", "color", "deadline", "account"].includes(
                key,
              )
                ? value
                : (parseMoney(value) ?? 0),
            }
          : g,
      ),
    );
  }
  return (
    <InlinePanel title="Vos objectifs" onClose={onClose}>
      {account && (
        <p>
          Projets affectés à {account}. Les autres projets du foyer sont
          conservés sans modification.
        </p>
      )}
      <p>
        Les montants affectés sont réservés, jamais ajoutés au solde. La
        contribution mensuelle sert aux propositions de budgets.
      </p>
      <div className="goal-tabs project-list">
        {ordered.map(({ goal: g, index: i }) => (
          <button
            key={i}
            aria-pressed={active === i}
            aria-label={`${g.name} · ${euro(g.saved)} réservés sur ${euro(g.target)}${i === 0 ? " · En vedette" : ""}`}
            style={goalAppearance(g.color)}
            onClick={() => setActive(i)}
          >
            <GoalIdentity goal={g} />
            <span>
              {g.name}
              {i === 0 && <small>En vedette</small>}
              <small>
                {euro(g.saved)} / {euro(g.target)}
              </small>
              <small>
                {g.saved >= g.target
                  ? "Objectif atteint"
                  : "Reste " + euro(g.target - g.saved)}
              </small>
            </span>
          </button>
        ))}
      </div>
      {goals.map(
        (g, i) =>
          active === i && (
            <fieldset
              key={i}
              className="project-editor"
              style={goalAppearance(g.color)}
            >
              <legend>
                <GoalIdentity goal={g} /> {g.name}
              </legend>
              <div className="form-grid">
                <Field label={"Nom du projet " + (i + 1)}>
                  <input
                    value={g.name}
                    onChange={(e) => change(i, "name", e.target.value)}
                  />
                </Field>
                {(
                  [
                    ["target", "Cible"],
                    ["saved", "Déjà réservé"],
                    ["monthly", "Épargne mensuelle"],
                  ] as const
                ).map(([key, title]) => (
                  <Field key={key} label={title + " (€) — projet " + (i + 1)}>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={(g[key] ?? 0) / 100}
                      onChange={(e) => change(i, key, e.target.value)}
                    />
                  </Field>
                ))}
                <Field label={"Échéance — projet " + (i + 1)}>
                  <input
                    type="date"
                    value={g.deadline ?? ""}
                    onChange={(e) => change(i, "deadline", e.target.value)}
                  />
                </Field>
                <Field label={"Compte — projet " + (i + 1)}>
                  <Select
                    value={g.account ?? ""}
                    onChange={(e) => change(i, "account", e.target.value)}
                  >
                    <option value="">Réserve du foyer</option>
                    {snapshot.accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.id}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              {g.deadline && g.deadline < today() && (
                <p className="project-note">
                  Échéance passée : vous pouvez la reporter sans perdre le
                  montant réservé.
                </p>
              )}
              <GoalAppearance
                goal={g}
                change={(key, value) => change(i, key, value)}
              />
              <p className="project-note">
                Retirer ce projet libère {euro(g.saved)} de réserve après
                enregistrement. Aucune transaction bancaire n’est créée.
              </p>
              <div className="actions">
                <button
                  className="button compact"
                  disabled={ordered[0]?.index === i}
                  onClick={() => movePriority(i, -1)}
                >
                  Monter la priorité
                </button>
                <button
                  className="button compact"
                  disabled={ordered.at(-1)?.index === i}
                  onClick={() => movePriority(i, 1)}
                >
                  Descendre la priorité
                </button>
              </div>
              <button
                className="text-button"
                onClick={() => {
                  setRemoved({ goal: g, index: i });
                  setGoals((gs) => gs.filter((_, n) => n !== i));
                  const remaining = goals.filter((_, n) => n !== i);
                  setActive(
                    account
                      ? remaining.findIndex((goal) => goal.account === account)
                      : Math.max(0, i - 1),
                  );
                }}
              >
                Retirer ce projet de la liste
              </button>
              {i > 0 && (
                <button
                  className="button compact"
                  onClick={() => {
                    setGoals((gs) => [gs[i], ...gs.filter((_, n) => n !== i)]);
                    setActive(0);
                  }}
                >
                  Mettre ce projet en vedette
                </button>
              )}
            </fieldset>
          ),
      )}
      {removed && (
        <div className="project-undo" role="status">
          « {removed.goal.name} » retiré du brouillon.{" "}
          <button
            className="text-button"
            onClick={() => {
              setGoals((gs) => [
                ...gs.slice(0, removed.index),
                removed.goal,
                ...gs.slice(removed.index),
              ]);
              setActive(removed.index);
              setRemoved(null);
            }}
          >
            Annuler le retrait
          </button>
        </div>
      )}
      <div className="actions">
        <button
          className="button"
          disabled={goals.length >= 101}
          onClick={() => {
            setActive(goals.length);
            setGoals([
              ...goals,
              {
                name: "Nouveau projet",
                target: 100000,
                saved: 0,
                monthly: 0,
                account: account || undefined,
                icon: "target",
                color: goalColors[goals.length % goalColors.length],
                priority: goals.length,
              },
            ]);
          }}
        >
          Ajouter un projet
        </button>
        <button
          className="button"
          onClick={() =>
            setGoals([
              ...goals,
              ...legacyGoalTemplates.filter(
                (g) => !goals.some((x) => x.name === g.name),
              ),
            ])
          }
        >
          Reprendre les 6 modèles historiques
        </button>
      </div>
      <small>
        Modèles de l’ancien code : fonds de sécurité, voiture, vacances, grand
        projet, épargne enfants. Les soldes personnels ne sont pas récupérés par
        ce bouton.
      </small>
      <GoalRecovery
        currentGoals={allGoals(snapshot)}
        onRecovered={(gs, summary) => {
          setGoals(gs);
          setActive(
            account ? gs.findIndex((goal) => goal.account === account) : 0,
          );
          notify(summary);
        }}
      />
      {error && <Notice error>{error}</Notice>}
      <div className="actions">
        <button className="button" disabled={saving} onClick={onClose}>
          Annuler les modifications
        </button>
        <button
          className="button yellow"
          disabled={saving}
          onClick={async () => {
            if (saving) return;
            setSaving(true);
            try {
              if (goals.length > 101)
                throw new Error("La limite est de 101 objectifs.");
              if (
                goals.some(
                  (g) =>
                    !g.name.trim() ||
                    g.target <= 0 ||
                    g.saved < 0 ||
                    (g.monthly ?? 0) < 0,
                )
              )
                throw new Error(
                  "Chaque objectif doit avoir un nom, une cible positive et des montants non négatifs.",
                );
              if (
                goals.some(
                  (g) =>
                    (g.deadline && parseDate(g.deadline) !== g.deadline) ||
                    (g.account &&
                      !snapshot.accounts.some((a) => a.id === g.account)),
                )
              )
                throw new Error(
                  "Vérifiez l’échéance et le compte de chaque objectif.",
                );
              await db.transaction(
                "rw",
                db.preferences,
                db.accounts,
                async () => {
                  const accountIds = new Set(
                    await db.accounts.toCollection().primaryKeys(),
                  );
                  if (
                    goals.some((g) => g.account && !accountIds.has(g.account))
                  )
                    throw new Error(
                      "Un compte a été retiré depuis l’ouverture. Choisissez un compte existant ou la réserve du foyer.",
                    );
                  if (
                    goals.some(
                      (g) =>
                        ![g.target, g.saved, g.monthly ?? 0].every(
                          Number.isSafeInteger,
                        ),
                    )
                  )
                    throw new Error(
                      "Les montants doivent rester des nombres valides en centimes.",
                    );
                  const latest =
                    (await db.preferences.get("main")) ?? snapshot.preferences;
                  if (
                    JSON.stringify(
                      allGoals({ ...snapshot, preferences: latest }),
                    ) !== initialGoals.current
                  )
                    throw new Error(
                      "Les objectifs ont changé ailleurs. Vos modifications sont conservées ici : fermez puis rouvrez l’éditeur pour repartir des données à jour.",
                    );
                  await db.preferences.put({
                    ...latest,
                    goal: goals[0]
                      ? {
                          ...goals[0],
                          account: goals[0].account || undefined,
                          deadline: goals[0].deadline || undefined,
                        }
                      : null,
                    extraGoals: goals.slice(1).map((g) => ({
                      ...g,
                      account: g.account || undefined,
                      deadline: g.deadline || undefined,
                    })),
                  });
                },
              );
              notify("Objectifs enregistrés.");
              onClose();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Enregistrement…" : "Enregistrer les objectifs"}
        </button>
      </div>
    </InlinePanel>
  );
}
export function Planning({
  snapshot,
  month,
  notify,
  onDone,
}: {
  snapshot: Snapshot;
  month: string;
  notify: (s: string) => void;
  onDone?: () => void;
}) {
  const [minimum, setMinimum] = useState(
      String(snapshot.preferences.safety / 100),
    ),
    [error, setError] = useState(""),
    [balancesOpen, setBalancesOpen] = useState(false),
    [legacy, setLegacy] = useState<ReturnType<typeof readLegacyPlan> | null>(
      null,
    ),
    [overrides, setOverrides] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(false);
  const [replaceLegacy, setReplaceLegacy] = useState(false),
    [legacyOutcome, setLegacyOutcome] = useState("");
  const legacyRequest = useRef(0);
  const plan = useMemo(
    () => suggestBudgets(snapshot, parseMoney(minimum) ?? 0),
    [snapshot, minimum],
  );
  const recurrences = useMemo(
    () => detectRecurrences(snapshot.transactions),
    [snapshot.transactions],
  );
  const currentCycle = budgetCycleKey(
    today(),
    budgetCalendar(snapshot.transactions, today()),
  );
  const targetMonth = month < currentCycle ? currentCycle : month;
  useEffect(() => {
    let active = true;
    const generation = legacyRequest.current;
    void (async () => {
      if (!indexedDB.databases) return;
      const existing = await indexedDB.databases();
      if (!existing.some((b) => b.name === "WealthPilotDB")) return;
      const old = new Dexie("WealthPilotDB");
      try {
        await old.open();
        const goals = await old.table("goals").toArray(),
          budgets = await old.table("budgets").toArray(),
          accounts = old.tables.some((t) => t.name === "accounts")
            ? await old.table("accounts").toArray()
            : [];
        const recovered = readLegacyPlan({
          meta: { formatVersion: 1 },
          tables: { goals, budgets, accounts },
        });
        if (
          active &&
          legacyRequest.current === generation &&
          (recovered.goals.length ||
            recovered.budgets.length ||
            recovered.warnings.length)
        )
          setLegacy(recovered);
      } finally {
        old.close();
      }
    })().catch(() => {
      /* Manual backup remains available if the old schema cannot be read. */
    });
    return () => {
      active = false;
    };
  }, []);
  const existing = snapshot.budgets.filter((b) => b.month === targetMonth);
  const legacyPreview = useMemo(() => {
    if (!legacy) return "";
    try {
      return goalRecoverySummary(
        mergeLegacyGoals(allGoals(snapshot), legacy.goals, replaceLegacy),
      );
    } catch (e) {
      return (e as Error).message;
    }
  }, [legacy, snapshot, replaceLegacy]);
  const proposed = (c: (typeof plan.categories)[number]) =>
    overrides[c.category] ??
    String(
      (existing.find((b) => b.category === c.category)?.amount ?? c.proposed) /
        100,
    );
  return (
    <section className="card planning">
      <span className="eyebrow">VOTRE PLAN, À PARTIR DES DONNÉES</span>
      <h2>On prépare la suite.</h2>
      <p>
        Les propositions utilisent {plan.months.length} cycle(s) observé(s) :{" "}
        {plan.months.join(", ") || "historique insuffisant"}. Elles restent des
        estimations, pas une promesse de rester dans le vert.
      </p>
      <Notice>
        {plan.coverage}{" "}
        {plan.known
          ? ""
          : "Sans solde confirmé, le minimum de fin de cycle ne peut pas être garanti."}
      </Notice>
      <button className="button" onClick={() => setBalancesOpen(!balancesOpen)}>
        Confirmer les soldes des comptes
      </button>
      {balancesOpen && (
        <EditorDialog
          inline
          kind="accounts"
          snapshot={snapshot}
          month={month}
          category=""
          notify={notify}
          onClose={() => setBalancesOpen(false)}
        />
      )}
      <div className="form-grid">
        <Field label="Minimum à conserver en fin de cycle (€)">
          <input
            type="number"
            min="0"
            step="0.01"
            value={minimum}
            onChange={(e) => {
              setMinimum(e.target.value);
              setOverrides({});
            }}
          />
        </Field>
        <div>
          <small>Revenus mensuels moyens observés</small>
          <h3>{euro(plan.income)}</h3>
          <small>
            Épargne projets / mois : {euro(plan.monthlyGoals)} · Ajustement
            proposé : −{Math.round((1 - plan.factor) * 100)} %
          </small>
        </div>
      </div>
      <details open>
        <summary>Budgets proposés pour {targetMonth}</summary>
        <p>
          Répartition proportionnelle aux dépenses passées, après l’effort
          d’épargne et le manque éventuel pour atteindre votre réserve. Ajustez
          les dépenses incompressibles avant validation. Les enveloppes déjà
          enregistrées sont conservées.
        </p>
        <div className="proposal-list">
          {plan.categories.map((c) => (
            <div key={c.category}>
              <span>
                <b>{c.category}</b>
                <small>
                  Moyenne {euro(c.average)} · {Math.round(c.share * 100)} % des
                  dépenses
                </small>
              </span>
              <Field label={"Budget proposé " + c.category + " (€)"}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={proposed(c)}
                  onChange={(e) =>
                    setOverrides({ ...overrides, [c.category]: e.target.value })
                  }
                />
              </Field>
            </div>
          ))}
        </div>
        {!plan.categories.length && (
          <p>
            Importez au moins un cycle antérieur pour proposer des enveloppes.
            Le minimum à conserver peut déjà être enregistré.
          </p>
        )}
      </details>
      <details>
        <summary>Récurrences détectées : {recurrences.length}</summary>
        <p>
          Trois occurrences minimum, montants proches et cadence régulière. Ce
          score indique la force du signal, pas une probabilité bancaire. Une
          suggestion refusée reste masquée après réimport.
        </p>
        {recurrences.map((r) => (
          <div className="recurrence-row" key={r.key}>
            <span>
              <b>{r.name}</b>
              <small>
                {r.account} · {r.count} observations ·{" "}
                {r.frequency === "monthly" ? "mensuel" : "hebdomadaire"} ·
                signal {r.confidence}/100 · attendu {dateLabel(r.next)}
              </small>
            </span>
            <strong>{euro(r.amount)}</strong>
            <button
              className="button compact"
              onClick={async () => {
                const expected =
                  snapshot.preferences.dismissedRecurrences?.includes(r.key) ??
                  false;
                try {
                  await db.transaction("rw", db.preferences, async () => {
                    const latest =
                      (await db.preferences.get("main")) ??
                      snapshot.preferences;
                    const dismissed = latest.dismissedRecurrences ?? [];
                    if (dismissed.includes(r.key) !== expected)
                      throw new Error(
                        "Cette cadence a changé ailleurs. Rechargez sa dernière version avant de la modifier.",
                      );
                    await db.preferences.put({
                      ...latest,
                      dismissedRecurrences: expected
                        ? dismissed.filter((key) => key !== r.key)
                        : [...dismissed, r.key],
                    });
                  });
                } catch (error) {
                  notify((error as Error).message);
                }
              }}
            >
              {snapshot.preferences.dismissedRecurrences?.includes(r.key)
                ? "Réactiver"
                : "Ignorer"}
            </button>
          </div>
        ))}
      </details>
      <details open={legacy ? true : undefined}>
        <summary>
          Récupérer mes objectifs et budgets personnels de l’ancienne app
        </summary>
        {legacy && (
          <Notice>
            Objectifs et budgets historiques détectés ou chargés :{" "}
            {legacy.goals.map((g) => g.name).join(", ")}. Confirmez leur reprise
            ci-dessous.
          </Notice>
        )}
        <p>
          L’ancienne adresse possède son propre stockage. Exportez sa sauvegarde
          JSON non chiffrée puis sélectionnez-la ici. Seuls les objectifs actifs
          et budgets mensuels seront repris, pas les opérations.
        </p>
        <input
          aria-label="Ancienne sauvegarde WealthPilot"
          type="file"
          accept=".json"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const input = e.target,
              generation = ++legacyRequest.current;
            setLegacy(null);
            setError("");
            setLegacyOutcome("");
            setReplaceLegacy(false);
            try {
              if (f.size > 30 * 1024 * 1024)
                throw new Error("Fichier trop volumineux.");
              const plan = readLegacyPlan(JSON.parse(await f.text()));
              if (generation === legacyRequest.current) setLegacy(plan);
            } catch (err) {
              if (generation === legacyRequest.current)
                setError((err as Error).message);
            }
            input.value = "";
          }}
        />
        {legacy && (
          <div>
            {legacy.warnings.map((warning, i) => (
              <Notice key={i}>{warning}</Notice>
            ))}
            <p>
              {legacy.goals.length} objectifs actifs · {legacy.budgets.length}{" "}
              budgets. Les enveloppes déjà présentes seront conservées. Les
              soldes des comptes liés sont ceux de cette sauvegarde, sans
              liaison automatique ultérieure.
            </p>
            <label className="check-line">
              <input
                type="checkbox"
                disabled={busy}
                checked={replaceLegacy}
                onChange={(e) => setReplaceLegacy(e.target.checked)}
              />
              Remplacer les objectifs déjà présents, y compris les modèles de
              départ, par les valeurs de cette sauvegarde
            </label>
            <Notice>{legacyPreview}</Notice>
            <button
              className="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  let summary = "",
                    addedBudgets = 0,
                    skippedBudgets = 0;
                  await db.transaction(
                    "rw",
                    db.preferences,
                    db.budgets,
                    async () => {
                      const latest = {
                        ...snapshot,
                        preferences:
                          (await db.preferences.get("main")) ??
                          snapshot.preferences,
                        budgets: await db.budgets.toArray(),
                      };
                      const merged = mergeLegacyGoals(
                        allGoals(latest),
                        legacy.goals,
                        replaceLegacy,
                      );
                      const gs = merged.goals;
                      summary = goalRecoverySummary(merged);
                      await db.preferences.put({
                        ...latest.preferences,
                        goal: gs[0] ?? null,
                        extraGoals: gs.slice(1),
                      });
                      for (const b of legacy.budgets) {
                        if (
                          !latest.budgets.some(
                            (x) =>
                              x.month === b.month && x.category === b.category,
                          )
                        ) {
                          await db.budgets.put({
                            ...b,
                            id: b.month + ":" + b.category,
                          });
                          latest.budgets.push({
                            ...b,
                            id: b.month + ":" + b.category,
                          });
                          addedBudgets++;
                        } else skippedBudgets++;
                      }
                    },
                  );
                  setLegacy(null);
                  const outcome = `${summary} ${addedBudgets} budgets ajoutés · ${skippedBudgets} conservés.`;
                  setLegacyOutcome(outcome);
                  notify(outcome);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Confirmer la reprise
            </button>
          </div>
        )}
        {legacyOutcome && <Notice>{legacyOutcome}</Notice>}
      </details>
      {error && <Notice error>{error}</Notice>}
      <div className="actions">
        <button
          className="button yellow"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const safety = parseMoney(minimum);
              if (safety === null || safety < 0)
                throw new Error("Minimum invalide.");
              const values = plan.categories.map((c) => {
                const amount = parseMoney(proposed(c));
                if (amount === null || amount < 0)
                  throw new Error("Budget invalide : " + c.category);
                return {
                  id: targetMonth + ":" + c.category,
                  category: c.category,
                  month: targetMonth,
                  amount,
                };
              });
              await db.transaction(
                "rw",
                db.budgets,
                db.preferences,
                async () => {
                  for (const v of values) {
                    const prior = existing.find(
                      (b) => b.category === v.category,
                    );
                    await db.budgets.put({ ...v, id: prior?.id ?? v.id });
                  }
                  await db.preferences.put({
                    ...((await db.preferences.get("main")) ??
                      snapshot.preferences),
                    safety,
                    setupDone: true,
                  });
                },
              );
              notify(
                "Plan enregistré. Les prochains imports ne remplaceront pas vos choix.",
              );
              onDone?.();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Enregistrer mon plan{onDone ? " et voir le dashboard" : ""}
        </button>
        {onDone && (
          <button className="button" onClick={onDone}>
            Continuer sans appliquer les propositions
          </button>
        )}
      </div>
    </section>
  );
}
