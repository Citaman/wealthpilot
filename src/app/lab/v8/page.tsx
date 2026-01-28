import Link from "next/link";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import styles from "./page.module.css";
import { stats, budgets, goals, transactions, alerts } from "../data";

const display = Fraunces({
  weight: ["400", "600"],
  subsets: ["latin"],
  variable: "--font-display",
});

const body = Source_Sans_3({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-body",
});

export default function LabV8Page() {
  return (
    <main className={`${styles.page} ${display.variable} ${body.variable}`}>
      <header className={styles.header}>
        <Link href="/lab" className={styles.back}>
          Back to Lab
        </Link>
        <div>
          <p className={styles.kicker}>Warm Atelier</p>
          <h1 className={styles.title}>Soft Light. Trusted Numbers.</h1>
          <p className={styles.sub}>Crafted calm, tactile texture, and humanist rhythm.</p>
        </div>
        <div className={styles.headerNote}>
          <span>Monthly health</span>
          <strong>Balanced</strong>
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
            <h2>Budgets</h2>
            <span>Warm guardrails</span>
          </div>
          {budgets.map((budget) => (
            <div key={budget.name} className={styles.row}>
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
            <span>Slow build</span>
          </div>
          {goals.map((goal) => (
            <div key={goal.name} className={styles.row}>
              <div>
                <p>{goal.name}</p>
                <span>{goal.target}</span>
              </div>
              <div className={styles.trackAlt}>
                <div style={{ width: `${goal.progress}%` }} />
              </div>
              <strong>{goal.progress}%</strong>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.split}>
        <div className={styles.panelAlt}>
          <div className={styles.panelHeader}>
            <h2>Transactions</h2>
            <span>Recent</span>
          </div>
          {transactions.map((tx) => (
            <div key={tx.name} className={styles.txRow}>
              <div>
                <p>{tx.name}</p>
                <span>{tx.category}</span>
              </div>
              <strong>{tx.amount}</strong>
            </div>
          ))}
        </div>
        <div className={styles.panelAlt}>
          <div className={styles.panelHeader}>
            <h2>Notes</h2>
            <span>Advisor</span>
          </div>
          {alerts.map((alert) => (
            <div key={alert.title} className={styles.alert}>
              <strong>{alert.title}</strong>
              <span>{alert.detail}</span>
            </div>
          ))}
        </div>
      </section>

      <footer className={styles.dock}>
        <div className={styles.dockNav}>
          <span>Home</span>
          <span>Insights</span>
          <span>Budgets</span>
          <span>Goals</span>
        </div>
        <div className={styles.dockCommand}>
          <input placeholder="Ask Atelier AI" />
        </div>
        <div className={styles.dockActions}>
          <button type="button">Notify</button>
          <button type="button">Quick tools</button>
        </div>
      </footer>
    </main>
  );
}
