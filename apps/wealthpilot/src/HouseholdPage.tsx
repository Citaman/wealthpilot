import { useMemo, useState } from "react";
import type { Snapshot } from "./types";
import { dateLabel, euro, monthEnd, today } from "./domain";
import { withEstimates } from "./intelligence";
import { db } from "./store";
import { Field, Notice } from "./ui";

export function HouseholdPage({
  snapshot,
  notify,
}: {
  snapshot: Snapshot;
  notify: (message: string) => void;
}) {
  const [members, setMembers] = useState(
      () =>
        snapshot.preferences.householdPlan?.members ??
        snapshot.accounts.map((a) => ({ name: a.id, account: a.id, share: 0 })),
    ),
    [error, setError] = useState("");
  const [revision, setRevision] = useState(() =>
    JSON.stringify(snapshot.preferences.householdPlan ?? null),
  );
  const dues = useMemo(
    () =>
      withEstimates(snapshot, monthEnd(today().slice(0, 7))).dues.filter(
        (d) => !d.transactionId && d.amount < 0 && d.date >= today(),
      ),
    [snapshot],
  );
  const valid =
    members.length > 0 &&
    members.every(
      (m) =>
        m.name.trim() &&
        Number.isFinite(m.share) &&
        m.share >= 0 &&
        m.share <= 100,
    ) &&
    Math.abs(members.reduce((n, m) => n + m.share, 0) - 100) < 0.001;
  const allocation = dues.map((d) => {
    let remaining = -d.amount;
    return {
      due: d,
      members: members.map((m, i) => {
        const amount =
          i === members.length - 1
            ? remaining
            : Math.floor((-d.amount * m.share) / 100);
        remaining -= amount;
        return { ...m, amount };
      }),
    };
  });
  async function save() {
    try {
      if (!valid)
        throw new Error(
          "Les parts doivent totaliser exactement 100 %. Choisissez la répartition explicitement.",
        );
      await db.transaction("rw", db.preferences, async () => {
        const p = (await db.preferences.get("main")) ?? snapshot.preferences;
        if (JSON.stringify(p.householdPlan ?? null) !== revision)
          throw new Error(
            "Le partage a changé. Rechargez pour comparer avant d’enregistrer.",
          );
        await db.preferences.put({ ...p, householdPlan: { members } });
      });
      setRevision(JSON.stringify({ members }));
      setError("");
      notify(
        "Règle du foyer enregistrée. Aucun historique ni virement modifié.",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <main className="page">
      <div className="page-title">
        <div>
          <span className="eyebrow">UNE RÈGLE CHOISIE, JAMAIS SUPPOSÉE</span>
          <h1>À chacun sa part.</h1>
        </div>
      </div>
      <section className="card">
        <h2>Répartition des prochaines charges</h2>
        <p>
          Chaque compte peut représenter un payeur. Les parts ne sont ni des
          droits d’accès ni des comptes utilisateurs synchronisés. Elles ne
          changent pas les dépenses passées.
        </p>
        {members.map((m, i) => (
          <div className="form-grid" key={m.account}>
            <Field label={`Nom du payeur ${m.account}`}>
              <input
                value={m.name}
                onChange={(e) =>
                  setMembers((ms) =>
                    ms.map((v, n) =>
                      n === i ? { ...v, name: e.target.value } : v,
                    ),
                  )
                }
              />
            </Field>
            <Field label={`Part de ${m.account} (%)`}>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={m.share}
                onChange={(e) =>
                  setMembers((ms) =>
                    ms.map((v, n) =>
                      n === i ? { ...v, share: Number(e.target.value) } : v,
                    ),
                  )
                }
              />
            </Field>
          </div>
        ))}
        <p>Total : {members.reduce((n, m) => n + m.share, 0).toFixed(2)} %</p>
        <div className="actions">
          <button
            className="button"
            onClick={() =>
              setMembers((ms) =>
                ms.map((m, i) => ({
                  ...m,
                  share:
                    i === ms.length - 1
                      ? 100 -
                        (Math.floor(10000 / ms.length) / 100) * (ms.length - 1)
                      : Math.floor(10000 / ms.length) / 100,
                })),
              )
            }
          >
            Proposer un partage égalitaire
          </button>
          <button className="button yellow" onClick={() => void save()}>
            Enregistrer cette règle
          </button>
        </div>
        {error && <Notice error>{error}</Notice>}
      </section>
      <section className="card">
        <h2>Approvisionnements à préparer</h2>
        {!valid ? (
          <p>
            Définissez d’abord les parts. Aucune division par deux n’est
            appliquée automatiquement.
          </p>
        ) : allocation.length ? (
          allocation.map(({ due, members: parts }) => (
            <article className="household-due" key={due.id}>
              <h3>
                {due.label} · {euro(-due.amount)}
              </h3>
              <p>
                À payer depuis {due.account} · {dateLabel(due.date)} ·{" "}
                {due.estimated ? "Estimation à confirmer" : "Échéance saisie"}
              </p>
              {parts.map((m) => (
                <p key={m.account}>
                  {m.name} : <b>{euro(m.amount)}</b>
                  {m.account === due.account
                    ? " · part du compte payeur à provisionner"
                    : ` à préparer depuis ${m.account} vers ${due.account}`}
                </p>
              ))}
            </article>
          ))
        ) : (
          <p>
            Aucune charge future détectée sur le mois. Vérifiez les récurrences
            ou ajoutez une échéance.
          </p>
        )}
        <small>
          Instructions de préparation seulement : ni virement exécuté, ni
          remboursement inventé. Vérifiez les soldes disponibles de chaque
          payeur avant de transférer.
        </small>
      </section>
    </main>
  );
}
