import { useState } from "react";
import type { Preferences, RecurrenceRule, Snapshot } from "./types";
import {
  activeRecurrences,
  withEstimates,
  type Recurrence,
} from "./intelligence";
import {
  addDays,
  dateLabel,
  euro,
  parseDate,
  parseMoney,
  today,
} from "./domain";
import { db } from "./store";
import { Field, InlinePanel, Notice } from "./ui";
import { Select } from "./Select";

export async function patchRecurringPreferences(
  snapshot: Snapshot,
  patch: (p: Preferences) => Partial<Preferences>,
) {
  await db.transaction("rw", db.preferences, async () => {
    const current = (await db.preferences.get("main")) ?? snapshot.preferences;
    await db.preferences.put({ ...current, ...patch(current) });
  });
}
export function RecurrencesPage({
  snapshot,
  account = "",
  notify,
}: {
  snapshot: Snapshot;
  account?: string;
  notify: (s: string) => void;
}) {
  const [draft, setDraft] = useState<RecurrenceRule | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const rows = activeRecurrences(snapshot).filter(
    (r) => !account || r.account === account,
  );
  const projected = withEstimates(snapshot, addDays(today(), 62));
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      notify("Récurrences mises à jour.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function edit(r: Recurrence) {
    const saved = snapshot.preferences.recurrenceRules?.find(
      (v) => v.id === r.ruleId,
    );
    setDraft(
      saved ?? {
        id: crypto.randomUUID(),
        name: r.name,
        account: r.account,
        amount: r.amount,
        category: r.category,
        frequency: r.frequency,
        next: r.next,
        sourceKey: r.key,
      },
    );
  }
  async function save(form: FormData) {
    if (!draft) return;
    const amount = parseMoney(String(form.get("amount"))),
      next = parseDate(String(form.get("next"))),
      end = String(form.get("end") ?? ""),
      name = String(form.get("name") ?? "").trim(),
      chosen = String(form.get("account"));
    if (
      !name ||
      name.length > 120 ||
      amount === null ||
      !amount ||
      !next ||
      (end && (!parseDate(end) || end < next)) ||
      !snapshot.accounts.some((a) => a.id === chosen)
    )
      throw new Error(
        "Vérifiez le nom, le compte, le montant signé et les dates.",
      );
    const rule: RecurrenceRule = {
      ...draft,
      name,
      amount,
      next,
      account: chosen,
      category: String(form.get("category") ?? "").trim() || "À catégoriser",
      frequency: form.get("frequency") === "weekly" ? "weekly" : "monthly",
      end: end || undefined,
    };
    await patchRecurringPreferences(snapshot, (p) => {
      const previous = snapshot.preferences.recurrenceRules?.find(
          (r) => r.id === draft.id,
        ),
        current = p.recurrenceRules?.find((r) => r.id === draft.id);
      if (JSON.stringify(previous) !== JSON.stringify(current))
        throw new Error(
          "Cette règle a changé ailleurs. Fermez puis rouvrez son édition.",
        );
      const others = (p.recurrenceRules ?? []).filter((r) => r.id !== rule.id);
      if (
        others.length >= 200 ||
        others.some(
          (r) =>
            (r.sourceKey && r.sourceKey === rule.sourceKey) ||
            (r.account === rule.account &&
              r.name.trim().toLocaleLowerCase() ===
                rule.name.toLocaleLowerCase() &&
              Math.sign(r.amount) === Math.sign(rule.amount)),
        )
      )
        throw new Error(
          "Une règle correspondante existe déjà, ou la limite de 200 règles est atteinte.",
        );
      return {
        recurrenceRules: [...others, rule],
        dismissedRecurrences: (p.dismissedRecurrences ?? []).filter(
          (k) => k !== rule.sourceKey,
        ),
      };
    });
    setDraft(null);
  }
  const toggle = (r: Recurrence) =>
    action(() =>
      patchRecurringPreferences(snapshot, (p) =>
        r.ruleId
          ? {
              recurrenceRules: (p.recurrenceRules ?? []).map((v) =>
                v.id === r.ruleId ? { ...v, paused: !r.paused } : v,
              ),
            }
          : {
              dismissedRecurrences: r.paused
                ? (p.dismissedRecurrences ?? []).filter((k) => k !== r.key)
                : [...new Set([...(p.dismissedRecurrences ?? []), r.key])],
            },
      ),
    );
  return (
    <main className="page">
      <div className="page-title">
        <div>
          <span className="eyebrow">ENGAGEMENTS & SOURCES</span>
          <h1>
            Récurrents<span className="pink-dot">.</span>
          </h1>
        </div>
        <button
          className="button yellow"
          disabled={!snapshot.accounts.length || busy}
          onClick={() =>
            setDraft({
              id: crypto.randomUUID(),
              name: "",
              account: account || snapshot.accounts[0]?.id || "",
              amount: -1000,
              category: "À catégoriser",
              frequency: "monthly",
              next: today(),
            })
          }
        >
          Nouvelle règle
        </button>
      </div>
      <Notice>
        Une suggestion n’est pas un contrat confirmé. Mettre en pause le suivi
        ne résilie aucun abonnement. Les revenus restent attendus, jamais déjà
        encaissés.
      </Notice>
      {error && <Notice error>{error}</Notice>}
      {draft && (
        <InlinePanel
          title="Configurer la récurrence"
          onClose={() => setDraft(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void action(() => save(f));
            }}
            key={draft.id}
          >
            <div className="form-grid">
              <Field label="Nom de la récurrence">
                <input
                  name="name"
                  required
                  maxLength={120}
                  defaultValue={draft.name}
                />
              </Field>
              <Field label="Compte de la récurrence">
                <Select
                  name="account"
                  value={draft.account}
                  onChange={(e) =>
                    setDraft({ ...draft, account: e.target.value })
                  }
                >
                  {snapshot.accounts.map((a) => (
                    <option key={a.id}>{a.id}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Montant signé (€)">
                <input
                  name="amount"
                  required
                  inputMode="decimal"
                  defaultValue={String(draft.amount / 100)}
                />
              </Field>
              <Field label="Catégorie">
                <input name="category" defaultValue={draft.category} />
              </Field>
              <Field label="Cadence">
                <Select
                  name="frequency"
                  value={draft.frequency}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      frequency:
                        e.target.value === "weekly" ? "weekly" : "monthly",
                    })
                  }
                >
                  <option value="monthly">Mensuelle</option>
                  <option value="weekly">Hebdomadaire</option>
                </Select>
              </Field>
              <Field label="Prochaine occurrence">
                <input
                  name="next"
                  type="date"
                  required
                  defaultValue={draft.next}
                />
              </Field>
              <Field label="Fin du contrat (facultative)">
                <input name="end" type="date" defaultValue={draft.end ?? ""} />
              </Field>
            </div>
            <p>
              Le montant est une hypothèse modifiable. Les écritures bancaires
              passées ne sont pas réécrites.
            </p>
            <div className="actions">
              <button
                type="button"
                className="button"
                onClick={() => setDraft(null)}
              >
                Annuler
              </button>
              <button className="button yellow" disabled={busy}>
                Enregistrer la règle
              </button>
            </div>
          </form>
        </InlinePanel>
      )}
      {[true, false].map((confirmed) => (
        <section
          key={String(confirmed)}
          aria-label={
            confirmed ? "Engagements confirmés" : "Suggestions détectées"
          }
        >
          <h2>
            {confirmed ? "Engagements confirmés" : "Suggestions détectées"}
          </h2>
          {!rows.some((r) => !!r.confirmed === confirmed) && (
            <Notice>
              {confirmed
                ? "Aucune règle confirmée. Validez une suggestion ou ajoutez une règle."
                : "Aucune cadence suffisamment régulière détectée sur ce périmètre."}
            </Notice>
          )}
          <div className="recurrence-grid">
            {rows
              .filter((r) => !!r.confirmed === confirmed)
              .map((r) => (
                <article className="card" key={r.key}>
                  <span className="eyebrow">
                    {r.account} ·{" "}
                    {r.frequency === "monthly" ? "Mensuel" : "Hebdomadaire"} ·{" "}
                    {r.paused
                      ? "Suivi en pause"
                      : r.confirmed
                        ? "Confirmé par vous"
                        : "Suggestion"}
                  </span>
                  <h3>{r.name}</h3>
                  <strong className="money">{euro(r.amount)}</strong>
                  <p>
                    Prochaine date théorique : {dateLabel(r.next)}
                    {r.end ? ` · Fin ${dateLabel(r.end)}` : ""}
                  </p>
                  {!r.confirmed && (
                    <small>
                      Indice heuristique {r.confidence}/100, pas une
                      probabilité.
                    </small>
                  )}
                  <p>
                    {r.count} opérations sources · de {euro(r.minimum)} à{" "}
                    {euro(r.maximum)}
                  </p>
                  <div className="actions">
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => edit(r)}
                    >
                      {r.confirmed
                        ? "Modifier la règle"
                        : "Vérifier et confirmer"}
                    </button>
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => void toggle(r)}
                    >
                      {r.paused
                        ? "Réactiver le suivi"
                        : r.confirmed
                          ? "Mettre en pause"
                          : "Ignorer cette suggestion"}
                    </button>
                  </div>
                  <details>
                    <summary>
                      Voir les sources et les prochaines occurrences
                    </summary>
                    {r.sourceIds.map((id) => {
                      const t = snapshot.transactions.find((v) => v.id === id);
                      return t ? (
                        <p key={id}>
                          {dateLabel(t.date)} · {t.merchant} · {euro(t.amount)}
                        </p>
                      ) : null;
                    })}
                    {projected.dues
                      .filter((d) => d.recurrenceKey === r.key)
                      .map((d) => (
                        <p key={d.id}>
                          {dateLabel(d.date)} · {euro(d.amount)}{" "}
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() =>
                              void action(() =>
                                patchRecurringPreferences(snapshot, (p) => ({
                                  ignoredOccurrences: [
                                    ...new Set([
                                      ...(p.ignoredOccurrences ?? []),
                                      d.id,
                                    ]),
                                  ],
                                })),
                              )
                            }
                          >
                            Ignorer cette occurrence
                          </button>
                        </p>
                      ))}
                    {(snapshot.preferences.ignoredOccurrences ?? [])
                      .filter((id) => id.startsWith("estimate:" + r.key + ":"))
                      .map((id) => (
                        <p key={id}>
                          {snapshot.dues.some(
                            (d) => d.originOccurrenceId === id,
                          )
                            ? "Ajustée dans le calendrier : "
                            : "Ignorée : "}
                          {dateLabel(id.slice(-10))}{" "}
                          {!snapshot.dues.some(
                            (d) => d.originOccurrenceId === id,
                          ) && (
                            <button
                              className="text-button"
                              disabled={busy}
                              onClick={() =>
                                void action(() =>
                                  patchRecurringPreferences(snapshot, (p) => ({
                                    ignoredOccurrences: (
                                      p.ignoredOccurrences ?? []
                                    ).filter((v) => v !== id),
                                  })),
                                )
                              }
                            >
                              Réactiver cette occurrence
                            </button>
                          )}
                        </p>
                      ))}
                  </details>
                </article>
              ))}
          </div>
        </section>
      ))}
    </main>
  );
}
