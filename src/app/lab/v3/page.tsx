import Link from "next/link";
import { Unbounded, Manrope } from "next/font/google";
import styles from "./page.module.css";
import { stats, budgets, goals, transactions, aiQuickActions, categorySplit } from "../data";

const display = Unbounded({
  weight: ["400", "600"],
  subsets: ["latin"],
  variable: "--font-display",
});

const body = Manrope({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-body",
});

export default function LabV3Page() {
  return (
    <main className={`${styles.page} ${display.variable} ${body.variable}`}>
      <header className={styles.header}>
        <Link href="/lab" className={styles.back}>
          Back to Lab
        </Link>
        <div>
          <p className={styles.kicker}>Glasswave AI</p>
          <h1 className={styles.title}>Finance with a Nervous System</h1>
          <p className={styles.sub}>Ambient intelligence, soft surfaces, and a command lane.</p>
        </div>
        <div className={styles.aiCard}>
          <p className={styles.aiLabel}>AI Pulse</p>
          <p className={styles.aiValue}>Cashflow healthy</p>
          <p className={styles.aiNote}>Risk down 3.1% this week</p>
        </div>
      </header>

      <section className={styles.stats}>
        {stats.map((stat) => (
          <div key={stat.label} className={styles.statCard}>
            <p>{stat.label}</p>
            <h3>{stat.value}</h3>
            <span>{stat.delta}</span>
          </div>
        ))}
      </section>

      <section className={styles.grid}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Category field</h2>
            <span>Smart split</span>
          </div>
          <div className={styles.pills}>
            {categorySplit.map((cat) => (
              <div key={cat.name} className={styles.pill}>
                <span>{cat.name}</span>
                <strong>{cat.value}%</strong>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Budgets</h2>
            <span>Autopilot</span>
          </div>
          {budgets.map((budget) => (
            <div key={budget.name} className={styles.progressRow}>
              <div>
                <p>{budget.name}</p>
                <span>{budget.total}</span>
              </div>
              <div className={styles.track}>
                <div style={{ width: `${budget.used}%` }} />
              </div>
              <strong>{budget.used}%</strong>
            </div>
          ))}
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Goals</h2>
            <span>Long range</span>
          </div>
          {goals.map((goal) => (
            <div key={goal.name} className={styles.goalRow}>
              <div>
                <p>{goal.name}</p>
                <span>{goal.target}</span>
              </div>
              <div className={styles.goalGauge}>
                <div style={{ width: `${goal.progress}%` }} />
              </div>
              <strong>{goal.progress}%</strong>
            </div>
          ))}
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Recent moves</h2>
            <span>Live feed</span>
          </div>
          <ul className={styles.txList}>
            {transactions.map((tx) => (
              <li key={tx.name}>
                <div>
                  <p>{tx.name}</p>
                  <span>{tx.category}</span>
                </div>
                <strong>{tx.amount}</strong>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className={styles.dock}>
        <div className={styles.dockLeft}>
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.dot} />
        </div>
        <div className={styles.dockCenter}>
          <input placeholder="Ask WealthPilot to explain this month" />
          <div className={styles.actionRow}>
            {aiQuickActions.map((action) => (
              <button key={action} type="button">
                {action}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.dockRight}>
          <button type="button">Notify</button>
          <button type="button">Tools</button>
          <button type="button">Profile</button>
        </div>
      </footer>
    </main>
  );
}
