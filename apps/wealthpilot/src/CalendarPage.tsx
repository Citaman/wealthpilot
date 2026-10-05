import { useEffect, useState, useRef } from "react";
import type { Due, Snapshot } from "./types";
import {
  addDays,
  balanceAt,
  dateLabel,
  euro,
  monthEnd,
  parseDate,
  parseMoney,
  today,
  weekStart,
} from "./domain";
import { allGoals, shiftMonth, withEstimates } from "./intelligence";
import { forecastCash } from "./forecasting";
import { db } from "./store";
import { Field, InlinePanel, Notice } from "./ui";
import { Select } from "./Select";
import { patchRecurringPreferences } from "./RecurrencesPage";
import "./calendar.css";

export function CalendarPage({
  snapshot,
  account = "",
  month = today().slice(0, 7),
  notify,
  navigationTarget,
}: {
  snapshot: Snapshot;
  account?: string;
  month?: string;
  notify: (s: string) => void;
  navigationTarget?: { id: string; date: string; revision: number };
}) {
  const [focus, setFocus] = useState(
      month === today().slice(0, 7) ? today() : month + "-01",
    ),
    [view, setView] = useState<"month" | "week" | "agenda">("month"),
    [selected, setSelected] = useState(focus),
    [draft, setDraft] = useState<Due | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const draftOriginal = useRef<Due | undefined>(undefined);
  const editorNode = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!draft) return;
    const frame = requestAnimationFrame(() => {
      editorNode.current?.scrollIntoView?.({
        block: "start",
        behavior: "instant",
      });
      editorNode.current
        ?.querySelector<HTMLInputElement>('input[name="label"]')
        ?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [draft?.id]);
  useEffect(() => {
    const date = month === today().slice(0, 7) ? today() : month + "-01";
    setFocus(date);
    setSelected(date);
  }, [month]);
  const first = view === "week" ? weekStart(focus) : focus.slice(0, 7) + "-01",
    last = view === "week" ? addDays(first, 6) : monthEnd(focus.slice(0, 7));
  const extended = withEstimates(snapshot, last),
    dues = extended.dues.filter(
      (d) =>
        (!account || d.account === account) &&
        d.date >= first &&
        d.date <= last,
    );
  const transactions = snapshot.transactions.filter(
    (t) =>
      (!account || t.account === account) && t.date >= first && t.date <= last,
  );
  const goals = allGoals(snapshot).filter(
    (g) =>
      g.deadline &&
      g.deadline >= first &&
      g.deadline <= last &&
      (!account || !g.account || g.account === account),
  );
  const dayStart = view === "month" ? weekStart(first) : first;
  const days = Array.from(
    {
      length:
        view === "month"
          ? 42
          : view === "week"
            ? 7
            : Math.round((Date.parse(last) - Date.parse(first)) / 86400000) + 1,
    },
    (_, i) => addDays(dayStart, i),
  );
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      notify("Calendrier mis à jour.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function changePeriod(offset: number) {
    const next =
      view === "week"
        ? addDays(focus, 7 * offset)
        : shiftMonth(focus.slice(0, 7), offset) + "-01";
    setFocus(next);
    setSelected(next);
  }
  function edit(d?: Due) {
    draftOriginal.current = d && !d.estimated ? structuredClone(d) : undefined;
    setDraft(
      d
        ? {
            ...d,
            id: d.estimated ? crypto.randomUUID() : d.id,
            originOccurrenceId: d.estimated ? d.id : d.originOccurrenceId,
            estimated: false,
            confidence: undefined,
            recurrenceConfirmed: undefined,
          }
        : {
            id: crypto.randomUUID(),
            date: selected,
            amount: -1000,
            label: "",
            account: account || snapshot.accounts[0]?.id || "",
          },
    );
  }
  useEffect(() => {
    if (!navigationTarget) return;
    const due = withEstimates(snapshot, navigationTarget.date).dues.find(
      (d) =>
        d.id === navigationTarget.id && (!account || d.account === account),
    );
    setFocus(navigationTarget.date);
    setSelected(navigationTarget.date);
    setView("agenda");
    if (due) edit(due);
    else
      setError(
        "Cette échéance n’est plus disponible dans ce périmètre. Aucune nouvelle échéance n’a été créée.",
      );
    // Only a new navigation intent opens an editor; financial refreshes keep its draft.
  }, [navigationTarget?.revision]);
  async function save(data: FormData) {
    if (!draft) return;
    const amount = parseMoney(String(data.get("amount"))),
      date = parseDate(String(data.get("date"))),
      label = String(data.get("label") ?? "").trim(),
      chosen = String(data.get("account")),
      transactionId = String(data.get("transaction") ?? "") || undefined;
    if (amount === null || !amount || !date || !label || label.length > 120)
      throw new Error("Vérifiez le libellé, le montant signé et la date.");
    await db.transaction(
      "rw",
      db.dues,
      db.transactions,
      db.accounts,
      db.preferences,
      async () => {
        if (!(await db.accounts.get(chosen)))
          throw new Error("Compte inconnu.");
        const current = await db.dues.get(draft.id),
          before = draftOriginal.current;
        if (JSON.stringify(current) !== JSON.stringify(before))
          throw new Error("Cette échéance a changé ailleurs. Rouvrez-la.");
        if (transactionId) {
          const tx = await db.transactions.get(transactionId);
          if (
            !tx ||
            tx.account !== chosen ||
            Math.sign(tx.amount) !== Math.sign(amount) ||
            (await db.dues
              .filter(
                (d) => d.id !== draft.id && d.transactionId === transactionId,
              )
              .count())
          )
            throw new Error(
              "Opération de rapprochement incompatible ou déjà utilisée.",
            );
        }
        await db.dues.put({
          ...draft,
          label,
          amount,
          date,
          account: chosen,
          category: String(data.get("category") ?? "").trim() || undefined,
          transactionId,
        });
        if (draft.originOccurrenceId) {
          const p = (await db.preferences.get("main")) ?? snapshot.preferences;
          await db.preferences.put({
            ...p,
            ignoredOccurrences: [
              ...new Set([
                ...(p.ignoredOccurrences ?? []),
                draft.originOccurrenceId,
              ]),
            ],
          });
        }
      },
    );
    setDraft(null);
  }
  const selectedDues = dues.filter((d) => d.date === selected),
    selectedTransactions = transactions.filter((t) => t.date === selected);
  return (
    <main className="page">
      <div className="page-title">
        <div>
          <span className="eyebrow">DES DATES, PAS DES SURPRISES</span>
          <h1>
            Calendrier<span className="pink-dot">.</span>
          </h1>
        </div>
        <button
          className="button yellow"
          disabled={!snapshot.accounts.length || busy}
          onClick={() => edit()}
        >
          Nouvelle échéance
        </button>
      </div>
      {error && <Notice error>{error}</Notice>}
      <div className="calendar-toolbar">
        <div className="actions">
          <button
            className="button"
            onClick={() => changePeriod(-1)}
            aria-label="Période précédente"
          >
            ←
          </button>
          <strong>
            {dateLabel(first)} — {dateLabel(last)}
          </strong>
          <button
            className="button"
            onClick={() => changePeriod(1)}
            aria-label="Période suivante"
          >
            →
          </button>
          <button
            className="button"
            onClick={() => {
              setFocus(today());
              setSelected(today());
            }}
          >
            Aujourd’hui
          </button>
        </div>
        <div className="actions" aria-label="Vue du calendrier">
          {(["month", "week", "agenda"] as const).map((v) => (
            <button
              key={v}
              className="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
            >
              {v === "month" ? "Mois" : v === "week" ? "7 jours" : "Agenda"}
            </button>
          ))}
        </div>
      </div>
      <Notice>
        Les opérations importées jusqu’à aujourd’hui sont réalisées ; celles
        datées dans le futur restent à venir. Les échéances et règles restent
        prévues tant qu’elles ne sont pas rapprochées. Les objectifs sont des
        dates de projet, pas des débits. Aucun déplacement ne modifie une
        opération bancaire.
      </Notice>
      <div className={view === "agenda" ? "calendar-agenda" : "calendar-grid"}>
        {days.map((date) => {
          const dayDues = dues.filter((d) => d.date === date),
            dayTx = transactions.filter((t) => t.date === date),
            futureImported = date > today(),
            dayGoals = goals.filter((g) => g.deadline === date);
          return (
            <button
              key={date}
              className={`calendar-day ${date.slice(0, 7) !== focus.slice(0, 7) ? "outside" : ""}`}
              aria-pressed={selected === date}
              aria-label={`${dateLabel(date)}, ${dayTx.length} opérations ${futureImported ? "importées à venir" : "réalisées"}, ${dayDues.length} échéances`}
              onClick={() => {
                setSelected(date);
                if (view === "month" && date.slice(0, 7) !== focus.slice(0, 7))
                  setFocus(date);
              }}
            >
              <strong>
                {view === "agenda" ? dateLabel(date) : date.slice(8)}
              </strong>
              <span>
                {dayTx.length
                  ? futureImported
                    ? `${dayTx.length} importée${dayTx.length > 1 ? "s" : ""} à venir`
                    : `${dayTx.length} réalisée${dayTx.length > 1 ? "s" : ""}`
                  : futureImported
                    ? "Aucune opération importée à venir"
                    : "Aucun mouvement réalisé"}
              </span>
              {dayDues
                .filter((d) => !d.transactionId)
                .slice(0, 3)
                .map((d) => (
                  <span
                    key={d.id}
                    className={
                      d.amount > 0 ? "calendar-income" : "calendar-expense"
                    }
                  >
                    {d.label} · {euro(d.amount)}
                  </span>
                ))}
              {dayDues.filter((d) => !d.transactionId).length > 3 && (
                <small>
                  + {dayDues.filter((d) => !d.transactionId).length - 3}{" "}
                  échéances
                </small>
              )}
              {dayGoals.map((g) => (
                <span key={g.name} className="calendar-goal">
                  ◎ {g.name}
                </span>
              ))}
            </button>
          );
        })}
      </div>
      <section className="card calendar-details" aria-label="Détail du jour">
        <h2>{dateLabel(selected)}</h2>
        <div className="calendar-balances">
          {snapshot.accounts
            .filter((a) => !account || a.id === account)
            .map((a) => {
              const forecast =
                  selected > today()
                    ? forecastCash(snapshot, selected, a.id)
                    : null,
                value =
                  forecast?.points.at(-1)?.value ??
                  balanceAt(a, snapshot.transactions, selected);
              return (
                <div key={a.id}>
                  <span>
                    {a.id} · {selected > today() ? "Projeté" : "Reconstruit"}
                  </span>
                  <strong>
                    {value === null ? "Solde à confirmer" : euro(value)}
                  </strong>
                </div>
              );
            })}
        </div>
        <h3>
          {selected > today()
            ? "Opérations importées à venir"
            : "Opérations réalisées"}
        </h3>
        {selectedTransactions.length ? (
          selectedTransactions.map((t) => (
            <p key={t.id}>
              {t.merchant} · {t.account} · <b>{euro(t.amount)}</b>
              {t.internal ? " · Virement interne" : ""}
            </p>
          ))
        ) : (
          <p>
            Aucune opération importée à cette date. Cela ne prouve pas une
            journée sans dépense.
          </p>
        )}
        <h3>Échéances</h3>
        {!selectedDues.length && <p>Aucune échéance prévue.</p>}
        {selectedDues.map((d) => (
          <div className="calendar-event" key={d.id}>
            <div>
              <strong>
                {d.label} · {euro(d.amount)}
              </strong>
              <p>
                {d.account} ·{" "}
                {d.transactionId
                  ? "Rapprochée"
                  : d.date < today()
                    ? "Échue, à vérifier"
                    : d.recurrenceConfirmed
                      ? "Règle confirmée"
                      : d.estimated
                        ? "Estimation détectée"
                        : "Échéance saisie"}
              </p>
            </div>
            <div className="actions">
              <button
                className="button"
                disabled={busy}
                onClick={() => edit(d)}
              >
                {d.estimated
                  ? "Ajuster cette occurrence"
                  : "Modifier / rapprocher"}
              </button>
              {d.estimated && (
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() =>
                    void action(() =>
                      patchRecurringPreferences(snapshot, (p) => ({
                        ignoredOccurrences: [
                          ...new Set([...(p.ignoredOccurrences ?? []), d.id]),
                        ],
                      })),
                    )
                  }
                >
                  Ignorer cette occurrence
                </button>
              )}
            </div>
          </div>
        ))}
        {goals
          .filter((g) => g.deadline === selected)
          .map((g) => (
            <p key={g.name}>
              ◎ Objectif {g.name} · {euro(g.saved)} réservés / {euro(g.target)}{" "}
              · aucune sortie bancaire créée.
            </p>
          ))}
        <p>
          Scénarios enregistrés :{" "}
          {(snapshot.preferences.scenarios ?? []).length}. Ils ne sont pas
          appliqués à cette vue centrale.
        </p>
      </section>
      {draft && (
        <div ref={editorNode} style={{ scrollMarginTop: 24 }}>
          <InlinePanel
            title="Échéance du calendrier"
            onClose={() => setDraft(null)}
          >
            <form
              key={draft.id}
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                void action(() => save(data));
              }}
            >
              <div className="form-grid">
                <Field label="Libellé de l’échéance">
                  <input
                    name="label"
                    required
                    maxLength={120}
                    defaultValue={draft.label}
                  />
                </Field>
                <Field label="Montant signé (€)">
                  <input
                    name="amount"
                    required
                    inputMode="decimal"
                    defaultValue={String(draft.amount / 100)}
                  />
                </Field>
                <Field label="Date prévue">
                  <input
                    name="date"
                    type="date"
                    required
                    defaultValue={draft.date}
                  />
                </Field>
                <Field label="Compte payeur">
                  <Select
                    name="account"
                    value={draft.account}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        account: e.target.value,
                        transactionId: undefined,
                      })
                    }
                  >
                    {snapshot.accounts.map((a) => (
                      <option key={a.id}>{a.id}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Catégorie de l’échéance">
                  <input name="category" defaultValue={draft.category ?? ""} />
                </Field>
                <Field label="Opération rapprochée">
                  <Select
                    name="transaction"
                    value={draft.transactionId ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        transactionId: e.target.value || undefined,
                      })
                    }
                  >
                    <option value="">Non rapprochée</option>
                    {snapshot.transactions
                      .filter(
                        (t) =>
                          t.account === draft.account &&
                          Math.sign(t.amount) === Math.sign(draft.amount) &&
                          !snapshot.dues.some(
                            (d) =>
                              d.id !== draft.id && d.transactionId === t.id,
                          ),
                      )
                      .toSorted((a, b) => b.date.localeCompare(a.date))
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.date} · {t.merchant} · {euro(t.amount)}
                        </option>
                      ))}
                  </Select>
                </Field>
              </div>
              <div className="actions">
                <button
                  className="button"
                  type="button"
                  onClick={() => setDraft(null)}
                >
                  Annuler
                </button>
                <button className="button yellow" disabled={busy}>
                  Enregistrer l’échéance
                </button>
              </div>
            </form>
          </InlinePanel>
        </div>
      )}
    </main>
  );
}
