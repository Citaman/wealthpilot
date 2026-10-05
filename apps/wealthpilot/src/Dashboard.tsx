import { Select } from "./Select";
import { PageActions } from "./PageActions";
import { memo, useMemo, useState, useRef, useEffect, useId } from "react";
import {
  SlidersHorizontal,
  ArrowUpRight,
  Plus,
  List,
  ArrowRight,
  Upload,
  Database,
} from "lucide-react";
import type { Snapshot, WidgetId, WidgetSize, Due } from "./types";
import type { TransactionDrilldown, TransactionSelection } from "./navigation";
import { contractFor } from "./widgetContracts";
import { isActiveWidget } from "./productScope";
import type { BoardInstance } from "./layout";
import { useBoardInstance } from "./BoardInstanceContext";
import { euro, dateLabel, today, addDays } from "./domain";
import { BalanceChart, aggregatePoints, type Point } from "./Chart";
import { type DateRange, type Granularity } from "./periods";
import { Empty, MerchantIcon, Notice, InlinePanel } from "./ui";
import { EditorDialog, type Editor } from "./Editors";
import { db } from "./store";
import { defaultSize, sizesFor, goalReserve } from "./intelligence";
import { InsightWidget } from "./InsightWidget";
import { DashboardBoard } from "./DashboardBoard";
import { merchantLabel } from "./search";
import { subcategoryOf } from "./merchants";
import { GoalsEditor, Planning } from "./Planning";
import { categoryPalette, readableMarkColor } from "./visual";
import { financialView } from "./financialView";
import { useCurrentDate } from "./useCurrentDate";
import { BudgetAlternatives } from "./BudgetAlternatives";
import type { VisualizationId } from "./visualizationRegistry";
function DashboardContent({
  snapshot: originalSnapshot,
  month,
  account: globalAccount,
  importPage,
  notify,
  from: globalFrom = month,
  range: globalRange,
  transactionsPage,
  duePage,
  navigatePage,
  card,
  onArrange,
  libraryMode = false,
}: {
  snapshot: Snapshot;
  month: string;
  account: string;
  importPage: () => void;
  notify: (s: string) => void;
  from?: string;
  range?: DateRange;
  transactionsPage?: (
    category?: string,
    context?: TransactionDrilldown,
  ) => void;
  duePage?: (scope: { account: string; month: string }, due?: Due) => void;
  navigatePage?: (
    page: string,
    scope: { account: string; month: string },
  ) => void;
  card?: BoardInstance;
  onArrange?: () => void;
  libraryMode?: boolean;
}) {
  const cardContext = useBoardInstance();
  const categoryColors = useMemo(
    () =>
      !card || card.type === "budgets" ? categoryPalette(originalSnapshot) : {},
    [originalSnapshot, card?.type],
  );
  const categoryColor = (category: string) =>
    readableMarkColor(
      categoryColors[category] ?? "#68615a",
      cardContext?.instance.tone,
    );
  const asOf = useCurrentDate();
  const contract = card ? contractFor(card.type) : undefined;
  const chartHeading = useId();
  const account =
    contract && contract.scope !== "account"
      ? ""
      : card?.source.kind === "account"
        ? card.source.account!
        : card?.source.kind === "household"
          ? ""
          : globalAccount;
  const from = useMemo(() => {
    if (contract && contract.period !== "range") return month;
    if (card?.period.kind !== "months") return globalFrom;
    const [year, m] = month.split("-").map(Number);
    const date = new Date(Date.UTC(year, m - card.period.months, 1));
    return date.toISOString().slice(0, 7);
  }, [card?.period, globalFrom, month, contract]);
  const snapshot = useMemo<Snapshot>(
    () =>
      card
        ? {
            ...originalSnapshot,
            preferences: {
              ...originalSnapshot.preferences,
              ...card.options,
              widgetViews: {
                ...originalSnapshot.preferences.widgetViews,
                ...(card.representation !== "default"
                  ? { [card.type]: card.representation }
                  : {}),
              },
            },
          }
        : originalSnapshot,
    [originalSnapshot, card],
  );
  const arrangeButton = useRef<HTMLButtonElement>(null);
  const opener = useRef<{
    element: HTMLElement;
    widget?: string;
    instance?: string;
    label: string;
    text: string;
  } | null>(null);
  function rememberOpener() {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement)) return;
    opener.current = {
      element,
      widget: (element.closest("[data-widget]") as HTMLElement | null)?.dataset
        .widget,
      instance: (element.closest("[data-instance]") as HTMLElement | null)
        ?.dataset.instance,
      label: element.getAttribute("aria-label") ?? "",
      text: element.textContent?.trim() ?? "",
    };
  }
  function restoreOpener() {
    const saved = opener.current;
    requestAnimationFrame(() => {
      if (!saved) return;
      if (saved.element.isConnected) {
        saved.element.focus();
        return;
      }
      const scope = saved.instance
        ? [...document.querySelectorAll<HTMLElement>("[data-instance]")].find(
            (element) => element.dataset.instance === saved.instance,
          )
        : saved.widget
          ? document.querySelector(`[data-widget="${saved.widget}"]`)
          : document;
      const controls = [
        ...(scope?.querySelectorAll<HTMLElement>(
          "button, a[href], input, [tabindex='0']",
        ) ?? []),
      ];
      const match = controls.find((element) =>
        saved.label
          ? element.getAttribute("aria-label") === saved.label
          : element.textContent?.trim() === saved.text,
      );
      (match ?? controls[0] ?? arrangeButton.current)?.focus();
    });
  }
  function closeEditor() {
    setEditor(null);
    restoreOpener();
  }
  function closeCalculation() {
    setCalc(false);
    restoreOpener();
  }
  const [editor, setEditor] = useState<Editor>(null),
    [arranging, setArranging] = useState(false),
    [category, setCategory] = useState(""),
    [metric, setMetric] = useState("balance"),
    [table, setTable] = useState(false),
    [calc, setCalc] = useState(false);
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [showForecast, setShowForecast] = useState(false);
  const [movingBudget, setMovingBudget] = useState<string | null>(null);
  const [budgetPreview, setBudgetPreview] = useState<string[] | null>(null);
  const budgetHover = useRef<string | null>(null);
  useEffect(() => {
    if (libraryMode && !card) setArranging(true);
  }, [libraryMode, card]);
  const { projected, dashboard: calculated } = useMemo(
    () =>
      financialView(
        snapshot,
        month,
        account,
        from,
        asOf,
        card?.period.kind === "months" ||
          (contract && contract.period !== "range")
          ? undefined
          : globalRange,
      ),
    [
      snapshot,
      month,
      account,
      from,
      asOf,
      globalRange,
      card?.period.kind,
      contract,
    ],
  );
  const d = useMemo(
    () =>
      !budgetPreview
        ? calculated
        : {
            ...calculated,
            budgets: [...calculated.budgets].sort(
              (a, b) =>
                budgetPreview.indexOf(a.category) -
                budgetPreview.indexOf(b.category),
            ),
          },
    [calculated, budgetPreview],
  );
  const p = snapshot.preferences;
  const selected =
    card?.representation !== "default" ? card?.representation : undefined;
  const chartDefault = selected ?? p.widgetViews?.chart;
  const budgetDefault = selected ?? p.widgetViews?.budgets;
  const chartPreset =
    chartDefault === "area" || chartDefault === "columns"
      ? chartDefault
      : "line";
  const budgetPreset =
    budgetDefault === "columns" || budgetDefault === "tiles"
      ? budgetDefault
      : budgetDefault === "rings"
        ? "rings"
        : budgetDefault === "bars"
          ? "list"
          : p.budgetView;
  const [chartVisual, setChartVisual] = useState<"line" | "area" | "columns">(
    chartPreset,
  );
  const [budgetVisual, setBudgetVisual] = useState<
    "list" | "rings" | "columns" | "tiles"
  >(budgetPreset);
  useEffect(() => setChartVisual(chartPreset), [chartPreset]);
  useEffect(() => setBudgetVisual(budgetPreset), [budgetPreset]);
  async function chooseVisual(
    widget: "chart" | "budgets",
    value: VisualizationId | "list",
  ) {
    const representation = value === "list" ? "bars" : value;
    if (widget === "chart") setChartVisual(value as typeof chartVisual);
    else setBudgetVisual(value as typeof budgetVisual);
    const options =
      widget === "budgets"
        ? {
            budgetView:
              value === "rings" ? ("rings" as const) : ("list" as const),
          }
        : {};
    try {
      if (cardContext)
        await cardContext.update({
          representation,
          options: { ...card?.options, ...options },
        });
      else
        await db.transaction("rw", db.preferences, async () => {
          const latest = (await db.preferences.get("main")) ?? p;
          await db.preferences.put({
            ...latest,
            ...options,
            widgetViews: { ...latest.widgetViews, [widget]: representation },
          });
        });
    } catch {
      setChartVisual(chartPreset);
      setBudgetVisual(budgetPreset);
      notify("Cette visualisation n’a pas pu être enregistrée.");
    }
  }
  const budgetLimit = (size: import("./types").WidgetSize) =>
    p.budgetLimit === 0
      ? d.budgets.length
      : (p.budgetLimit ??
        { tiny: 1, small: 2, medium: 3, large: 5, xlarge: 8 }[size]);
  const ringBudgets = (size: import("./types").WidgetSize) =>
    d.budgets.slice(0, Math.min(8, budgetLimit(size)));
  async function budgetPreference(patch: Partial<typeof p>) {
    try {
      if (cardContext) {
        await cardContext.update({ options: { ...card?.options, ...patch } });
        return;
      }
      await db.transaction("rw", db.preferences, async () => {
        const latest = (await db.preferences.get("main")) ?? p;
        await db.preferences.put({ ...latest, ...patch });
      });
    } catch {
      notify("Impossible d’enregistrer la disposition des budgets.");
    }
  }
  function previewBudget(source: string, target: string) {
    const order = d.budgets.map((b) => b.category);
    const index = order.indexOf(source),
      next = order.indexOf(target);
    if (index < 0 || next < 0 || index === next) return order;
    order.splice(index, 1);
    order.splice(next, 0, source);
    return order;
  }
  async function placeBudget(source: string, target: string) {
    const order = budgetPreview ?? previewBudget(source, target);
    setBudgetPreview(order);
    setMovingBudget(null);
    await budgetPreference({ budgetOrder: order });
    setBudgetPreview(null);
    budgetHover.current = null;
  }
  const itemLimit = (size: import("./types").WidgetSize) => {
    return size === "tiny"
      ? 1
      : size === "small"
        ? 3
        : size === "medium"
          ? 5
          : size === "large"
            ? 6
            : 12;
  };
  const openTransactions = (selection: TransactionSelection = {}) => {
    if (transactionsPage)
      transactionsPage(selection.category ?? "", {
        account,
        from,
        month,
        range: { from: d.period.from, to: d.cutoff },
        ...selection,
      });
    else {
      setCategory(selection.category ?? "");
      setEditor("transactions");
    }
  };
  const open = (kind: Editor, c = "") => {
    if (kind === "goal") return;
    rememberOpener();
    if (kind === "layout") {
      if (onArrange) {
        onArrange();
        return;
      }
      setEditor(null);
      setArranging(true);
      return;
    }
    if (kind === "transactions" && transactionsPage) {
      openTransactions({ category: c });
      return;
    }
    if (kind === "dues" && duePage) {
      duePage({ account, month });
      return;
    }
    setCategory(c);
    setEditor(kind);
  };
  const points = useMemo(() => {
    if (metric === "balance")
      return aggregatePoints(
        d.points.filter((point) => showForecast || !point.future),
        granularity,
      );
    let running = d.tx
      .filter((t) => !t.internal && t.date < d.period.from)
      .reduce((n, t) => n + t.amount, 0);
    const arr: Point[] = [];
    const byDate = new Map<string, number>();
    for (const t of d.tx)
      if (!t.internal) byDate.set(t.date, (byDate.get(t.date) ?? 0) + t.amount);
    for (let date = d.period.from; date <= d.cutoff; date = addDays(date, 1)) {
      if (date > d.cutoff) break;
      running += byDate.get(date) ?? 0;
      arr.push({ date, value: running, future: false });
    }
    return aggregatePoints(arr, granularity);
  }, [d, metric, showForecast, granularity]);
  const hasData = !!snapshot.transactions.length;
  const last = snapshot.batches.toSorted((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )[0];
  // Use the same pending stream as the cash forecast, including imported
  // future-dated operations. These are not editable calendar objects.
  const due = d.projection.events.toSorted((a, b) =>
    a.date.localeCompare(b.date),
  );
  const calculation = (
    <InlinePanel title="Le calcul du disponible" onClose={closeCalculation}>
      <p>
        Foyer · {dateLabel(d.cutoff)}. Estimation, sous réserve de relevés
        complets.
      </p>
      {account ? (
        <Notice>
          Choisissez Tous les comptes pour consulter le disponible du foyer.
        </Notice>
      ) : (
        <dl className="calculation">
          <div>
            <dt>Solde calculé</dt>
            <dd>{d.balance === null ? "À confirmer" : euro(d.balance)}</dd>
          </div>
          <div>
            <dt>Échéances saisies non payées</dt>
            <dd>− {euro(d.confirmedObligations)}</dd>
          </div>
          <div>
            <dt>Récurrences estimées, à vérifier</dt>
            <dd>− {euro(d.estimatedObligations)}</dd>
          </div>
          <div>
            <dt>
              {p.essentials > 0
                ? "Dépenses essentielles réservées"
                : "Enveloppes restant à financer"}
            </dt>
            <dd>− {euro(d.essentials)}</dd>
          </div>
          <div>
            <dt>Argent réservé aux projets</dt>
            <dd>− {euro(goalReserve(snapshot))}</dd>
          </div>
          <div>
            <dt>Réserve de sécurité</dt>
            <dd>− {euro(p.safety)}</dd>
          </div>
          <div className="total">
            <dt>
              {d.available !== null && d.available < 0
                ? "Manque pour couvrir le plan"
                : "Disponible estimé"}
            </dt>
            <dd>{d.available === null ? "À confirmer" : euro(d.available)}</dd>
          </div>
        </dl>
      )}
      <p>
        Les revenus futurs ne sont pas du cash disponible. Votre enveloppe
        hebdomadaire se prépare dans Ma semaine.
      </p>
      {d.available !== null && d.available < 0 && (
        <Notice>
          Le solde bancaire n’est pas nécessairement négatif : le total des
          charges et réserves dépasse ce solde de {euro(-d.available)}. Les
          enveloppes comprennent tous vos budgets, y compris les dépenses
          facultatives. Les revenus futurs ne sont pas ajoutés au disponible
          aujourd’hui. Vérifiez les estimations, les enveloppes et l’argent
          réellement réservé aux projets.
        </Notice>
      )}
      {goalReserve(snapshot) > 0 && p.safety > 0 && (
        <p>
          Vérifiez que l’épargne d’un objectif « fonds de sécurité » n’est pas
          aussi comprise dans votre réserve de sécurité : ces deux montants sont
          actuellement protégés séparément.
        </p>
      )}
      <button
        className="button yellow"
        onClick={() => {
          setCalc(false);
          open("plan");
        }}
      >
        Modifier mes réserves
      </button>
    </InlinePanel>
  );
  const sections = (
    size: import("./types").WidgetSize,
  ): Partial<Record<WidgetId, () => React.ReactNode>> => ({
    chart: () => (
      <section className="card chart-card" aria-labelledby={chartHeading}>
        <div className="card-heading">
          <h2 id={chartHeading}>
            {metric === "flow" ? "Flux nets cumulés" : "Évolution du solde"}
          </h2>
          <div className="controls">
            <Select
              aria-label="Mesure du graphique"
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
            >
              <option value="balance">Solde des comptes</option>
              <option value="flow">Flux nets cumulés</option>
            </Select>
            <button
              className="icon-button"
              aria-label={
                table
                  ? "Masquer les valeurs du graphique"
                  : "Afficher les valeurs du graphique"
              }
              aria-pressed={table}
              onClick={() => setTable(!table)}
            >
              <List size={18} />
            </button>
          </div>
        </div>
        <div className="component-views" aria-label="Visualisation du solde">
          {(["line", "area", "columns"] as const).map((value) => (
            <button
              key={value}
              aria-pressed={chartVisual === value}
              onClick={() => void chooseVisual("chart", value)}
            >
              {
                {
                  line: "Trajectoire",
                  area: "Surface",
                  columns: "Colonnes",
                }[value]
              }
            </button>
          ))}
        </div>
        <div className="chart-period-controls">
          <div
            className="segmented"
            role="group"
            aria-label="Granularité du graphique"
          >
            {(["day", "week", "month"] as const).map((value) => (
              <button
                key={value}
                aria-pressed={granularity === value}
                onClick={() => setGranularity(value)}
              >
                {{ day: "Jour", week: "Semaine", month: "Mois" }[value]}
              </button>
            ))}
          </div>
          {metric === "balance" && (
            <div
              className="segmented"
              role="group"
              aria-label="Historique ou prévision"
            >
              <button
                aria-pressed={!showForecast}
                onClick={() => setShowForecast(false)}
              >
                Historique
              </button>
              <button
                aria-pressed={showForecast}
                onClick={() => setShowForecast(true)}
              >
                Avec prévision
              </button>
            </div>
          )}
        </div>
        <div className="chart-legend">
          <span>
            <i className="line black" />
            Calculé
          </span>
          {metric === "balance" && showForecast && (
            <span>
              <i className="line cyan" />
              Prévision partielle
            </span>
          )}
          {metric === "balance" && (
            <span>
              <i className="line pink" />
              Réserve de sécurité
            </span>
          )}
        </div>
        {metric === "flow" && (
          <p className="metric-explainer">
            Entrées moins sorties, cumulées depuis la première opération
            importée ({d.tx.map((t) => t.date).sort()[0] ?? "—"}), avec zéro
            comme référence : ce n’est pas le solde bancaire. Les virements
            entre vos comptes sont exclus.
          </p>
        )}
        {metric === "balance" && showForecast && hasData && (
          <p className="metric-explainer">
            {account
              ? "Projection de ce compte : échéances uniquement. Les provisions du foyer ne sont pas affectées aux comptes ; cette courbe ne garantit pas que toutes les dépenses sont couvertes."
              : "Prévision partielle : échéances connues et provision restante pour les essentiels ou les enveloppes, répartie progressivement. Cette répartition est une estimation, pas des opérations bancaires prévues à date certaine."}
          </p>
        )}
        {!hasData ? (
          <Empty
            title="Votre première vue commence ici."
            action="Importer mon CSV"
            onAction={importPage}
          >
            Importez vos opérations pour voir vos dépenses et vos comptes.
          </Empty>
        ) : !points.length ? (
          <Empty
            title="Confirmons vos soldes."
            action="Renseigner les soldes"
            onAction={() => open("accounts")}
          >
            Les opérations sont importées. Ajoutez un solde bancaire daté ou
            sélectionnez les flux nets cumulés.
          </Empty>
        ) : (
          <>
            <BalanceChart
              visual={chartVisual}
              mode={metric === "flow" ? "flow" : "balance"}
              points={points}
              safety={metric === "balance" ? p.safety : 0}
              showTable={table}
            />
          </>
        )}
        {hasData && (
          <div className="chart-summary">
            {!p.widgets.includes("balance") && (
              <div>
                <small>Solde au {dateLabel(d.cutoff)}</small>
                <strong>
                  {d.balance === null ? "À confirmer" : euro(d.balance)}
                </strong>
              </div>
            )}
            {!p.widgets.includes("flows") && (
              <div>
                <small>Dépenses de la période</small>
                <strong>{euro(d.spending)}</strong>
              </div>
            )}
            {!p.widgets.includes("flows") && (
              <div>
                <small>Revenus de la période</small>
                <strong>{euro(d.income)}</strong>
              </div>
            )}
            {showForecast && d.low && !p.widgets.includes("low") && (
              <div>
                <small>Point bas partiel · {dateLabel(d.low.date)}</small>
                <strong>{euro(d.low.value)}</strong>
              </div>
            )}
          </div>
        )}
        {hasData && (
          <div className="card-foot">
            <span>
              Couverture à vérifier · les opérations absentes ne sont pas
              devinées.
            </span>
            <button className="text-button" onClick={() => open("accounts")}>
              Soldes des comptes ↗
            </button>
          </div>
        )}
      </section>
    ),
    available: () =>
      size === "tiny" ? (
        <section className="card available-compact">
          <span className="eyebrow">Disponible à dépenser</span>
          <strong className="compact-amount">
            {account || d.available === null
              ? "—"
              : euro(Math.max(0, d.available))}
          </strong>
          <button
            className="text-button"
            onClick={() => {
              rememberOpener();
              setCalc(true);
            }}
          >
            {!account && d.available !== null && d.available < 0
              ? `${euro(-d.available)} à couvrir`
              : "Après charges et réserves"}{" "}
            <ArrowUpRight size={14} />
          </button>
        </section>
      ) : (
        <section className="card dark-card available-card">
          <div className="card-heading">
            <span className="eyebrow">DISPONIBLE À DÉPENSER</span>
            <button
              className="light-icon"
              aria-label="Configurer le disponible"
              onClick={() => open("plan")}
            >
              <SlidersHorizontal size={18} />
            </button>
          </div>
          <div className="accent-circles" aria-hidden="true">
            <i />
            <i />
          </div>
          <span className="period-pill">
            {new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(
              new Date(month + "-15"),
            )}
          </span>
          <div
            className="hero-amount"
            style={{
              fontSize: `clamp(18px, ${Math.min(14, 130 / (d.available !== null ? euro(d.available).length : 1))}cqw, 96px)`,
            }}
          >
            {account || d.available === null
              ? "—"
              : euro(Math.max(0, d.available))}
          </div>
          {size !== "small" && (
            <h3>
              {d.available !== null && d.available < 0
                ? "aucune marge libre selon le plan"
                : "après les charges et les réserves"}
            </h3>
          )}
          {!account && d.available !== null && d.available < 0 && (
            <p className="shortfall">
              <strong>{euro(-d.available)} à couvrir</strong>
              <span>
                Charges + budgets + réserves dépassent le solde actuel.
              </span>
            </p>
          )}
          {size !== "small" && (
            <p className="muted-light">
              {account
                ? "Disponible calculé sur le foyer : choisissez Tous les comptes."
                : d.available === null
                  ? "Un solde confirmé est nécessaire."
                  : "Après les échéances, enveloppes restantes et réserves. Estimations incluses."}
            </p>
          )}
          <div className="available-bottom">
            <button
              className="button outline-light"
              onClick={() => {
                rememberOpener();
                setCalc(true);
              }}
            >
              Voir le calcul
              <ArrowUpRight size={16} />
            </button>
          </div>
        </section>
      ),
    budgets: () => (
      <section className={`card budget-card budget-density-${size}`}>
        <div className="card-heading">
          <h2>Vos budgets</h2>
        </div>
        <div className="component-views" aria-label="Visualisation des budgets">
          {(["list", "rings", "columns", "tiles"] as const).map((value) => (
            <button
              key={value}
              aria-label={`Budgets en ${{ list: "liste", rings: "anneaux", columns: "marges", tiles: "enveloppes" }[value]}`}
              aria-pressed={budgetVisual === value}
              onClick={() => void chooseVisual("budgets", value)}
            >
              {
                {
                  list: "Liste",
                  rings: "Anneaux",
                  columns: "Marges",
                  tiles: "Enveloppes",
                }[value]
              }
            </button>
          ))}
        </div>
        {!d.budgets.length ? (
          <Empty
            title="À chaque dépense, une place."
            action="Créer mes enveloppes"
            onAction={() => open("budgets")}
          >
            Définissez vos limites. Les dépenses importées sont déjà classées
            par catégorie.
          </Empty>
        ) : (
          <>
            <p className="budget-period mono">
              Enveloppes :{" "}
              {[...new Set(d.budgets.flatMap((b) => b.coveredMonths))]
                .sort()
                .map((m) =>
                  new Intl.DateTimeFormat("fr-FR", {
                    month: "short",
                    year: "numeric",
                  }).format(new Date(m + "-01T12:00:00")),
                )
                .join(" · ")}
            </p>
            {budgetVisual === "columns" || budgetVisual === "tiles" ? (
              <BudgetAlternatives
                color={categoryColor}
                budgets={d.budgets}
                mode={budgetVisual}
                open={(category) => open("transactions", category)}
              />
            ) : (
              <div
                className={
                  budgetVisual === "rings"
                    ? "budget-content rings"
                    : "budget-content"
                }
              >
                {budgetVisual === "rings" && (
                  <svg
                    viewBox="0 0 220 220"
                    role="img"
                    aria-label={`Dépenses réalisées par rapport au plafond des ${ringBudgets(size).length} premières enveloppes ; engagements détaillés dans la liste`}
                  >
                    <text
                      x="110"
                      y="108"
                      textAnchor="middle"
                      className="ring-number"
                      style={{
                        fontSize: ringBudgets(size).length > 5 ? 13 : 20,
                      }}
                    >
                      {euro(ringBudgets(size).reduce((s, b) => s + b.spent, 0))}
                    </text>
                    <text
                      x="110"
                      y="128"
                      textAnchor="middle"
                      className="ring-label"
                      style={{ fontSize: 9 }}
                    >
                      {d.budgets.length > ringBudgets(size).length
                        ? `${ringBudgets(size).length} affichées`
                        : "dépensés"}
                    </text>
                    {ringBudgets(size).map((b, i) => {
                      const r = 100 - i * 10,
                        circ = 2 * Math.PI * r;
                      return (
                        <g key={b.id} transform="rotate(-90 110 110)">
                          <circle
                            cx="110"
                            cy="110"
                            r={r}
                            fill="none"
                            stroke="var(--track)"
                            strokeWidth="7"
                          />
                          <circle
                            cx="110"
                            cy="110"
                            r={r}
                            fill="none"
                            stroke={categoryColor(b.category)}
                            strokeWidth="7"
                            strokeLinecap="round"
                            strokeOpacity={b.spent > 0 ? 1 : 0}
                            strokeDasharray={circ}
                            strokeDashoffset={
                              circ *
                              (1 -
                                Math.min(1, b.amount ? b.spent / b.amount : 1))
                            }
                          />
                        </g>
                      );
                    })}
                  </svg>
                )}
                <div className="budget-bars">
                  {size !== "small" && (
                    <div className="budget-display">
                      <span>Afficher</span>
                      {[3, 4, 6, 0].map((n) => (
                        <button
                          key={n}
                          aria-pressed={
                            n === 0
                              ? p.budgetLimit === 0
                              : p.budgetLimit !== 0 && budgetLimit(size) === n
                          }
                          onClick={() =>
                            void budgetPreference({ budgetLimit: n })
                          }
                        >
                          {n || "Tout"}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="budget-entries">
                    {d.budgets
                      .slice(0, movingBudget ? undefined : budgetLimit(size))
                      .map((b) => (
                        <div
                          className="budget-entry"
                          key={b.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData(
                              "text/wealthpilot-budget",
                              b.category,
                            );
                            setMovingBudget(b.category);
                            budgetHover.current = null;
                          }}
                          onDragEnd={(e) => {
                            setMovingBudget(null);
                            if (e.dataTransfer.dropEffect === "none")
                              setBudgetPreview(null);
                            budgetHover.current = null;
                          }}
                          onDragOver={(e) => {
                            if (movingBudget) {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = "move";
                              if (
                                b.category !== movingBudget &&
                                budgetHover.current !== b.category
                              ) {
                                budgetHover.current = b.category;
                                setBudgetPreview(
                                  previewBudget(movingBudget, b.category),
                                );
                              }
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              setMovingBudget(null);
                              setBudgetPreview(null);
                              budgetHover.current = null;
                            }
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const source = e.dataTransfer.getData(
                              "text/wealthpilot-budget",
                            );
                            if (source) placeBudget(source, b.category);
                          }}
                        >
                          <button
                            className="budget-row"
                            onClick={() => open("transactions", b.category)}
                          >
                            <span
                              className="category-dot"
                              style={{ background: categoryColor(b.category) }}
                            />
                            <div>
                              <div className="budget-label">
                                <strong>{b.category}</strong>
                                <span>
                                  {b.amount
                                    ? Math.round((b.spent / b.amount) * 100) +
                                      " %"
                                    : "Sans plafond"}
                                </span>
                              </div>
                              {size !== "small" && (
                                <span className="mono">
                                  {euro(b.spent)} dépensés / {euro(b.amount)}{" "}
                                  alloués
                                </span>
                              )}
                              <div
                                className="progress budget-progress"
                                aria-hidden="true"
                              >
                                <i
                                  style={{
                                    width:
                                      Math.min(
                                        100,
                                        b.amount
                                          ? (b.spent / b.amount) * 100
                                          : b.spent > 0
                                            ? 100
                                            : 0,
                                      ) + "%",
                                    background: categoryColor(b.category),
                                  }}
                                />
                                {b.committed > 0 && (
                                  <i
                                    className="budget-committed"
                                    style={{
                                      width: `${b.amount > 0 ? Math.max(0, Math.min(b.committed / b.amount, 1 - b.spent / b.amount)) * 100 : 0}%`,
                                      color: categoryColor(b.category),
                                    }}
                                  />
                                )}
                              </div>
                              <small>
                                {b.committed > 0 && (
                                  <>
                                    {euro(b.committed)} engagés (échéances)
                                    ·{" "}
                                  </>
                                )}
                                {euro(Math.abs(b.remaining))}{" "}
                                {b.remaining < 0
                                  ? "de dépassement après engagements"
                                  : "restants après engagements"}
                              </small>
                            </div>
                          </button>
                          <div className="budget-order">
                            <button
                              aria-label={
                                movingBudget
                                  ? `Placer ${movingBudget} à la place de ${b.category}`
                                  : `Déplacer ${b.category}`
                              }
                              aria-pressed={movingBudget === b.category}
                              onClick={() =>
                                movingBudget && movingBudget !== b.category
                                  ? placeBudget(movingBudget, b.category)
                                  : setMovingBudget(
                                      movingBudget ? null : b.category,
                                    )
                              }
                            >
                              ⠿
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                  {movingBudget && (
                    <p role="status">
                      Déplacement de {movingBudget} : glissez sur une enveloppe
                      ou cliquez sur sa poignée pour choisir la destination.{" "}
                      <button
                        onClick={() => {
                          setMovingBudget(null);
                          setBudgetPreview(null);
                          budgetHover.current = null;
                        }}
                      >
                        Annuler
                      </button>
                    </p>
                  )}
                  {d.budgets.length > budgetLimit(size) && (
                    <button
                      className="text-button"
                      onClick={() => void budgetPreference({ budgetLimit: 0 })}
                    >
                      Voir les {d.budgets.length} enveloppes{" "}
                      <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
        <div className="card-foot">
          {size !== "small" && (
            <span>
              {account
                ? "Enveloppes affectées à ce compte · hors virements internes"
                : "Consommé réel · hors virements internes"}
              {from !== month
                ? " · uniquement les mois disposant d’une enveloppe"
                : ""}
            </span>
          )}
          <button className="text-button" onClick={() => open("budgets")}>
            Modifier
            <ArrowUpRight size={14} />
          </button>
        </div>
      </section>
    ),
    dues: () => (
      <section className="card">
        <div className="card-heading">
          <h2>Échéances à venir</h2>
          <button className="button compact" onClick={() => open("dues")}>
            Gérer
            <ArrowRight size={15} />
          </button>
        </div>
        {!due.length ? (
          <Empty
            title="Rien de renseigné."
            action="Ajouter une échéance"
            onAction={() => open("dues")}
          >
            Les cadences régulières détectées apparaîtront ici. Vous pouvez
            aussi ajouter une charge ponctuelle.
          </Empty>
        ) : (
          <div className="dues-list">
            {due.slice(0, itemLimit(size)).map((v) => (
              <button
                key={v.id}
                onClick={() => {
                  if (v.id.startsWith("known:"))
                    openTransactions({ transactionId: v.id.slice(6) });
                  else if (duePage) duePage({ account, month }, v);
                  else open("dues");
                }}
              >
                <span className="date-tile">
                  <b>{v.date.slice(8)}</b>
                  <small>
                    {new Intl.DateTimeFormat("fr-FR", {
                      month: "short",
                    }).format(new Date(v.date + "T12:00:00"))}
                  </small>
                </span>
                <span>
                  <strong>{v.label}</strong>
                  <small>
                    {v.account}
                    {v.id.startsWith("known:")
                      ? " · Importée à date future"
                      : v.estimated
                        ? ` · Estimée · signal ${v.confidence}/100`
                        : " · Saisie"}
                    {v.date < today() ? " · Échue, à vérifier" : ""}
                  </small>
                </span>
                <b>{euro(v.amount)}</b>
              </button>
            ))}
          </div>
        )}
      </section>
    ),
    transactions: () => (
      <section className="card">
        <div className="card-heading">
          <h2>Dernières opérations</h2>
          <button
            className="button compact"
            onClick={() => open("transactions")}
          >
            Tout voir
            <ArrowRight size={15} />
          </button>
        </div>
        {!d.rows.length ? (
          <Empty
            title="Aucune opération sur cette période."
            action="Importer un CSV"
            onAction={importPage}
          />
        ) : (
          <div className="transactions-list">
            {d.rows
              .toSorted((a, b) => b.date.localeCompare(a.date))
              .slice(0, itemLimit(size))
              .map((t) => (
                <button
                  key={t.id}
                  onClick={() => openTransactions({ transactionId: t.id })}
                >
                  <MerchantIcon
                    name={merchantLabel(t)}
                    category={t.category}
                    subcategory={t.subcategory || subcategoryOf(t.raw)}
                  />
                  <span>
                    <strong>{merchantLabel(t)}</strong>
                    <small>
                      {dateLabel(t.date)} ·{" "}
                      {t.internal ? "Virement interne" : t.category}
                    </small>
                  </span>
                  <b className={t.amount > 0 ? "positive" : ""}>
                    {euro(t.amount)}
                  </b>
                </button>
              ))}
          </div>
        )}
      </section>
    ),
    sources: () =>
      size === "tiny" ? (
        <section className="card sources-compact">
          <h2>Source et fraîcheur</h2>
          <p>
            {last ? dateLabel(last.createdAt.slice(0, 10)) : "Aucun import"}
          </p>
          <button className="text-button" onClick={importPage}>
            Importer un CSV <ArrowUpRight size={14} />
          </button>
        </section>
      ) : (
        <section className="card">
          <div className="card-heading">
            <h2>Source et fraîcheur</h2>
            <Database size={20} />
          </div>
          <div className="freshness">
            <span className={"status-dot " + (last ? "" : "off")} />
            <span>
              {last
                ? "Dernier import : " + dateLabel(last.createdAt.slice(0, 10))
                : "Aucun fichier importé"}
              <small>
                {last
                  ? snapshot.transactions.length + " opérations conservées"
                  : "Vos fichiers restent sur cet appareil."}
              </small>
              {!!snapshot.transactions.length && (
                <small>
                  Dernière opération :{" "}
                  {dateLabel(
                    snapshot.transactions.reduce(
                      (latest, t) => (t.date > latest ? t.date : latest),
                      snapshot.transactions[0].date,
                    ),
                  )}
                </small>
              )}
            </span>
          </div>
          {size !== "small" && (
            <div className="source-list">
              {snapshot.accounts.slice(0, itemLimit(size)).map((a) => (
                <button key={a.id} onClick={() => open("accounts")}>
                  <span>{a.id}</span>
                  <small>
                    {a.checkpoint
                      ? "Solde au " + dateLabel(a.checkpoint.date)
                      : "Solde à confirmer"}
                    <ArrowUpRight size={14} />
                  </small>
                </button>
              ))}
            </div>
          )}
          {(size === "large" || size === "xlarge") && (
            <p className="footnote">
              {snapshot.batches.length} imports conservés ·{" "}
              {snapshot.accounts.length} comptes. Un import récent ne prouve pas
              que tous les comptes sont à jour.
            </p>
          )}
          <button className="button dark full" onClick={importPage}>
            <Upload size={17} />
            Importer un CSV
          </button>
          <p className="footnote">
            Données locales ·{" "}
            <button className="text-button" onClick={() => open("data")}>
              Pensez à sauvegarder
            </button>
          </p>
        </section>
      ),
  });
  const renderWidget = (id: WidgetId, size: WidgetSize) => {
    if (!isActiveWidget(id)) return null;
    const owner: Partial<Record<Exclude<Editor, null>, WidgetId>> = {
      accounts: "chart",
      plan: "available",
      budgets: "budgets",
      goal: "goal",
      dues: "dues",
      data: "sources",
      transactions: "transactions",
    };
    const editing = editor && (owner[editor] === id || !!card);
    return (
      <div
        key={id}
        className={
          "widget widget-" +
          id +
          " widget-size-" +
          size +
          (editing ? " widget-editing" : "")
        }
      >
        {id === "available" && calc ? (
          calculation
        ) : editing ? (
          editor === "goal" ? (
            <GoalsEditor
              account={account}
              snapshot={originalSnapshot}
              notify={notify}
              onClose={closeEditor}
            />
          ) : (
            <>
              <EditorDialog
                inline
                kind={editor as Exclude<Editor, null>}
                snapshot={originalSnapshot}
                month={month}
                category={category}
                account={account}
                onClose={closeEditor}
                notify={notify}
              />
              {editor === "plan" && (
                <Planning
                  snapshot={originalSnapshot}
                  month={month}
                  notify={notify}
                />
              )}
              {editor === "dues" && (
                <section className="inline-panel">
                  <h3>Échéances estimées depuis vos opérations</h3>
                  <p>
                    Une estimation ignorée disparaît aussi des calculs. Pour
                    corriger un montant ou une date, ajoutez une échéance
                    manuelle portant le même nom et ignorez la cadence détectée.
                  </p>
                  {due
                    .filter((v) => v.estimated)
                    .map((v) => (
                      <div className="recurrence-row" key={v.id}>
                        <span>
                          <b>{v.label}</b>
                          <small>
                            {dateLabel(v.date)} · {v.account} · signal{" "}
                            {v.confidence}/100
                          </small>
                        </span>
                        <strong>{euro(v.amount)}</strong>
                        <button
                          className="button compact"
                          onClick={async () => {
                            try {
                              await db.transaction(
                                "rw",
                                db.preferences,
                                async () => {
                                  const latest =
                                    (await db.preferences.get("main")) ??
                                    originalSnapshot.preferences;
                                  await db.preferences.put({
                                    ...latest,
                                    dismissedRecurrences: [
                                      ...(latest.dismissedRecurrences ?? []),
                                      v.recurrenceKey!,
                                    ],
                                  });
                                },
                              );
                              notify(
                                "Cette récurrence est ignorée dans les prévisions.",
                              );
                            } catch (e) {
                              notify((e as Error).message);
                            }
                          }}
                        >
                          Ignorer cette récurrence
                        </button>
                      </div>
                    ))}
                  {!due.some((v) => v.estimated) && (
                    <p>
                      Aucune échéance estimée pour cette sélection. Retrouvez
                      les cadences ignorées dans le plan du disponible.
                    </p>
                  )}
                </section>
              )}
            </>
          )
        ) : (
          (sections(size)[id]?.() ?? (
            <InsightWidget
              id={id}
              snapshot={projected}
              d={d}
              month={month}
              from={from}
              account={account}
              size={size}
              configure={() => open("layout")}
              transactions={openTransactions}
              goals={() => open("goal")}
              plan={() => open("plan")}
              navigate={(page) => {
                if (page === "accounts") open("accounts");
                else if (page === "recurrents") open("plan");
                else if (navigatePage) navigatePage(page, { account, month });
                else window.location.hash = page;
              }}
            />
          ))
        )}
      </div>
    );
  };
  if (card)
    return (
      <>
        {contract?.scope !== "none" &&
          (card.source.kind !== "global" ||
            card.period.kind !== "global" ||
            contract?.period === "live" ||
            contract?.scope === "household") && (
            <p className="instance-context-label">
              {contract?.scope === "household"
                ? "Tout le foyer"
                : card.source.kind === "account"
                  ? account
                  : card.source.kind === "household"
                    ? "Tout le foyer"
                    : "Filtre global"}{" "}
              ·{" "}
              {contract?.period === "live"
                ? "Situation actuelle"
                : contract?.period === "cutoff"
                  ? `Au ${dateLabel(d.cutoff)}`
                  : card.period.kind === "months"
                    ? card.period.months + " mois"
                    : "Période globale"}
            </p>
          )}
        {renderWidget(card.type, card.size)}
      </>
    );
  return (
    <main className="page dashboard">
      <h1 className="sr-only">Dashboard</h1>
      {!arranging && (
        <PageActions page="dashboard">
          <button
            ref={arrangeButton}
            className="dock-action"
            aria-label="Organiser mon dashboard"
            onClick={() => open("layout")}
          >
            <SlidersHorizontal size={17} />
            <span>Organiser</span>
          </button>
        </PageActions>
      )}
      {!!d.overdue.length && (
        <Notice>
          {d.overdue.length} échéance(s) échue(s) non rapprochée(s). La
          prévision ne les reporte pas automatiquement.{" "}
          <button className="text-button" onClick={() => open("dues")}>
            Vérifier
          </button>
        </Notice>
      )}
      {account && (
        <Notice>
          Filtre {account} pour les cartes qui suivent le contexte. Les cartes
          avec leur propre source l’indiquent. Les réserves du foyer ne sont pas
          réparties arbitrairement entre les comptes.
        </Notice>
      )}
      <DashboardBoard
        snapshot={snapshot}
        openCatalog={libraryMode}
        editing={arranging}
        onFinish={() => {
          setArranging(false);
          if (libraryMode) window.location.hash = "dashboard";
          requestAnimationFrame(() => arrangeButton.current?.focus());
        }}
        notify={notify}
      >
        {(id, size, instance) =>
          instance ? (
            <Dashboard
              key={instance.id}
              snapshot={originalSnapshot}
              month={month}
              from={globalFrom}
              range={globalRange}
              account={globalAccount}
              importPage={importPage}
              notify={notify}
              transactionsPage={transactionsPage}
              duePage={duePage}
              navigatePage={navigatePage}
              card={instance}
              onArrange={() => setArranging(true)}
            />
          ) : (
            renderWidget(id, size)
          )
        }
      </DashboardBoard>
      {!(
        p.board?.views
          .find((view) => view.id === p.board?.activeView)
          ?.instances.filter((instance) => isActiveWidget(instance.type))
          .length ?? p.widgets.filter(isActiveWidget).length
      ) && (
        <Empty
          title="Votre vue est vide."
          action="Choisir mes blocs"
          onAction={() => open("layout")}
        />
      )}
      {editor &&
        editor !== "layout" &&
        !p.widgets.includes(
          (
            {
              accounts: "chart",
              plan: "available",
              budgets: "budgets",
              goal: "goal",
              dues: "dues",
              data: "sources",
              transactions: "transactions",
            } as const
          )[editor],
        ) && (
          <InlinePanel title="Modifier les données" onClose={closeEditor}>
            {editor === "goal" ? (
              <GoalsEditor
                snapshot={snapshot}
                notify={notify}
                onClose={closeEditor}
              />
            ) : (
              <EditorDialog
                inline
                kind={editor}
                snapshot={snapshot}
                month={month}
                category={category}
                account={account}
                onClose={closeEditor}
                notify={notify}
              />
            )}
          </InlinePanel>
        )}
    </main>
  );
}
export const Dashboard = memo(DashboardContent);
