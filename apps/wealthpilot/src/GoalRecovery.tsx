import { useState, useEffect, useRef } from "react";
import Dexie from "dexie";
import { Upload, ArrowDownToLine } from "lucide-react";
import {
  readLegacyPlan,
  mergeLegacyGoals,
  goalRecoverySummary,
} from "./intelligence";
import { euro } from "./domain";
import { db } from "./store";
import { defaultPreferences, type Goal } from "./types";
import { Notice } from "./ui";

export function GoalRecovery({
  currentGoals,
  onRecovered,
}: {
  currentGoals: Goal[];
  onRecovered: (goals: Goal[], summary: string) => void;
}) {
  const [goals, setGoals] = useState<Goal[]>([]),
    [chosen, setChosen] = useState<number[]>([]),
    [replace, setReplace] = useState(false),
    [warnings, setWarnings] = useState<string[]>([]),
    [error, setError] = useState(""),
    [outcome, setOutcome] = useState(""),
    [busy, setBusy] = useState(false),
    [source, setSource] = useState("");
  const request = useRef(0);
  function loaded(value: unknown, label: string) {
    const plan = readLegacyPlan(value);
    setGoals(plan.goals);
    setChosen(plan.goals.map((_, i) => i));
    setWarnings(plan.warnings);
    setSource(label);
    setOutcome("");
    setError(
      plan.goals.length || plan.warnings.length
        ? ""
        : "Aucun objectif actif dans cette sauvegarde.",
    );
  }
  useEffect(() => {
    let active = true;
    const generation = request.current;
    void (async () => {
      if (!indexedDB.databases) return;
      const names = await indexedDB.databases();
      if (!names.some((d) => d.name === "WealthPilotDB")) return;
      const old = new Dexie("WealthPilotDB");
      try {
        await old.open();
        const tables: {
          goals: unknown[];
          budgets: unknown[];
          accounts: unknown[];
        } = { goals: [], budgets: [], accounts: [] };
        for (const name of ["goals", "budgets", "accounts"] as const)
          if (old.tables.some((t) => t.name === name))
            tables[name] = await old.table(name).toArray();
        if (active && request.current === generation)
          loaded(
            { meta: { formatVersion: 1 }, tables },
            "Ancienne base trouvée sur cette adresse",
          );
      } finally {
        old.close();
      }
    })().catch(() => {
      /* The manual backup path remains available. */
    });
    return () => {
      active = false;
    };
  }, []);
  const selected = chosen.map((i) => goals[i]);
  let preview = "";
  try {
    preview = goalRecoverySummary(
      mergeLegacyGoals(currentGoals, selected, replace),
    );
  } catch (e) {
    preview = (e as Error).message;
  }
  return (
    <details
      className="goal-recovery"
      open={
        goals.length || warnings.length || error || outcome ? true : undefined
      }
    >
      <summary>
        <ArrowDownToLine size={17} />
        Retrouver mes objectifs de l’ancien WealthPilot
      </summary>
      <p>
        Les modèles de départ ne contiennent pas vos montants personnels.
        Chargez la sauvegarde JSON de l’ancienne application. Les soldes des
        comptes liés seront repris à la date de cette sauvegarde, sans liaison
        automatique ultérieure.
      </p>
      <label className="button recovery-file">
        <Upload size={16} />
        Choisir l’ancienne sauvegarde
        <input
          type="file"
          accept=".json"
          aria-label="Sauvegarde des anciens objectifs"
          disabled={busy}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const input = e.target,
              generation = ++request.current;
            setGoals([]);
            setChosen([]);
            setWarnings([]);
            setError("");
            setOutcome("");
            setReplace(false);
            setSource("");
            try {
              if (f.size > 30 * 1024 * 1024)
                throw Error("Fichier trop volumineux.");
              const value = JSON.parse(await f.text());
              if (generation === request.current) loaded(value, f.name);
            } catch (e) {
              if (generation === request.current)
                setError((e as Error).message);
            }
            input.value = "";
          }}
        />
      </label>
      {warnings.map((warning, i) => (
        <Notice key={i}>{warning}</Notice>
      ))}
      {goals.length > 0 && (
        <>
          <p className="mono">
            {source} · {goals.length} objectifs
          </p>
          <div className="recovered-goals">
            {goals.map((g, i) => (
              <label className="check-line" key={i}>
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={chosen.includes(i)}
                  onChange={(e) =>
                    setChosen(
                      e.target.checked
                        ? [...chosen, i]
                        : chosen.filter((n) => n !== i),
                    )
                  }
                />
                <span>
                  <b>{g.name}</b>
                  <small>
                    {euro(g.saved)} réservés / {euro(g.target)}
                    {g.deadline ? " · échéance " + g.deadline : ""}
                  </small>
                </span>
              </label>
            ))}
          </div>
          <label className="check-line">
            <input
              type="checkbox"
              disabled={busy}
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
            />
            Remplacer les objectifs déjà présents, y compris les modèles de
            départ, par les valeurs de cette sauvegarde
          </label>
          <Notice>{preview}</Notice>
          <button
            className="button dark"
            disabled={busy || !chosen.length}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                let result: ReturnType<typeof mergeLegacyGoals> | undefined;
                await db.transaction("rw", db.preferences, async () => {
                  const p =
                    (await db.preferences.get("main")) ?? defaultPreferences;
                  result = mergeLegacyGoals(
                    [...(p.goal ? [p.goal] : []), ...(p.extraGoals ?? [])],
                    selected,
                    replace,
                  );
                  if (result.added || result.replaced)
                    await db.preferences.put({
                      ...p,
                      goal: result.goals[0] ?? null,
                      extraGoals: result.goals.slice(1),
                    });
                });
                const summary = goalRecoverySummary(result!);
                onRecovered(result!.goals, summary);
                setOutcome(summary);
                setGoals([]);
                setChosen([]);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Confirmer la récupération
          </button>
        </>
      )}
      {outcome && <Notice>{outcome}</Notice>}
      {error && <Notice error>{error}</Notice>}
    </details>
  );
}
