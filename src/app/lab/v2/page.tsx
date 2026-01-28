import Link from "next/link";
import { Bodoni_Moda, Work_Sans } from "next/font/google";
import styles from "./page.module.css";
import { stats, budgets, goals, transactions } from "../data";

const display = Bodoni_Moda({
  weight: ["400", "600"],
  subsets: ["latin"],
  variable: "--font-display",
});

const body = Work_Sans({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-body",
});

export default function LabV2Page() {
  return (
    <main className={`${styles.page} ${display.variable} ${body.variable}`}>
      <div className={styles.rail}>
        <Link href="/lab" className={styles.railBack}>
          Lab Index
        </Link>
        <div className={styles.railLabel}>WealthPilot</div>
        <div className={styles.railNav}>
          <span>Overview</span>
          <span>Insights</span>
          <span>Budgets</span>
          <span>Goals</span>
        </div>
      </div>

      <section className={styles.content}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>Swiss Editorial Grid</p>
            <h1 className={styles.title}>Clarity Before Everything</h1>
            <p className={styles.subtitle}>
              Quiet layout, hairline rules, and decisive typography. Editorial, not app-like.
            </p>
          </div>
          <div className={styles.command}>
            <label>Command</label>
            <input placeholder="Explain spending variance" />
          </div>
        </header>

        <div className={styles.rules}>
          <div />
          <span>Month view</span>
          <div />
        </div>

        <section className={styles.stats}>
          {stats.map((stat) => (
            <div key={stat.label} className={styles.statItem}>
              <p>{stat.label}</p>
              <h3>{stat.value}</h3>
              <span>{stat.delta}</span>
            </div>
          ))}
        </section>

        <section className={styles.grid}>
          <div className={styles.chartPanel}>
            <div className={styles.panelHeader}>
              <h2>Cashflow rhythm</h2>
              <span>Last 12 months</span>
            </div>
            <svg viewBox="0 0 420 120" className={styles.chart} role="img" aria-label="line chart">
              <path
                d="M10 90 L60 72 L110 78 L160 60 L210 66 L260 40 L310 48 L360 30 L410 36"
                fill="none"
                stroke="#101216"
                strokeWidth="2"
              />
              <path
                d="M10 110 L60 94 L110 96 L160 88 L210 86 L260 74 L310 70 L360 62 L410 58"
                fill="none"
                stroke="#b7bcc6"
                strokeWidth="1"
              />
            </svg>
            <p className={styles.note}>Net cashflow is 4.2% above last quarter.</p>
          </div>

          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Budget allocation</h2>
              <span>Accuracy</span>
            </div>
            {budgets.map((budget) => (
              <div key={budget.name} className={styles.budgetRow}>
                <span>{budget.name}</span>
                <div className={styles.budgetTrack}>
                  <div style={{ width: `${budget.used}%` }} />
                </div>
                <strong>{budget.used}%</strong>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.split}>
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Goals cadence</h2>
              <span>Long horizon</span>
            </div>
            {goals.map((goal) => (
              <div key={goal.name} className={styles.goalRow}>
                <div>
                  <h4>{goal.name}</h4>
                  <p>Target {goal.target}</p>
                </div>
                <span>{goal.progress}%</span>
              </div>
            ))}
          </div>

          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Transactions</h2>
              <span>Latest entries</span>
            </div>
            <div className={styles.txTable}>
              {transactions.map((tx) => (
                <div key={tx.name} className={styles.txRow}>
                  <span>{tx.name}</span>
                  <span>{tx.category}</span>
                  <strong>{tx.amount}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
