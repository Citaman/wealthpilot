import Link from "next/link";
import { Syne, IBM_Plex_Sans } from "next/font/google";
import styles from "./page.module.css";
import { stats, budgets, goals, transactions, alerts } from "../data";

const display = Syne({
  weight: ["600", "700"],
  subsets: ["latin"],
  variable: "--font-display",
});

const body = IBM_Plex_Sans({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-body",
});

export default function LabV7Page() {
  return (
    <main className={`${styles.page} ${display.variable} ${body.variable}`}>
      <aside className={styles.tower}>
        <Link href="/lab" className={styles.back}>
          Lab
        </Link>
        <div className={styles.towerLabel}>Monolith</div>
        <div className={styles.towerNav}>
          <button type="button">Overview</button>
          <button type="button">Budgets</button>
          <button type="button">Goals</button>
          <button type="button">Calendar</button>
        </div>
        <div className={styles.towerActions}>
          <button type="button">New entry</button>
          <button type="button">AI brief</button>
        </div>
      </aside>

      <section className={styles.content}>
        <header className={styles.header}>
          <p className={styles.kicker}>Monolith Minimal</p>
          <h1 className={styles.title}>Reduce UI to Power</h1>
          <p className={styles.sub}>Black and white. No softness. Every number counts.</p>
        </header>

        <div className={styles.stats}>
          {stats.map((stat) => (
            <div key={stat.label} className={styles.statCard}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <em>{stat.delta}</em>
            </div>
          ))}
        </div>

        <div className={styles.grid}>
          <div className={styles.panel}>
            <h2>Budget limits</h2>
            {budgets.map((budget) => (
              <div key={budget.name} className={styles.row}>
                <span>{budget.name}</span>
                <div className={styles.track}>
                  <div style={{ width: `${budget.used}%` }} />
                </div>
                <strong>{budget.used}%</strong>
              </div>
            ))}
          </div>

          <div className={styles.panel}>
            <h2>Goals</h2>
            {goals.map((goal) => (
              <div key={goal.name} className={styles.row}>
                <span>{goal.name}</span>
                <div className={styles.track}>
                  <div style={{ width: `${goal.progress}%` }} />
                </div>
                <strong>{goal.progress}%</strong>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.split}>
          <div className={styles.panel}>
            <h2>Transactions</h2>
            {transactions.map((tx) => (
              <div key={tx.name} className={styles.txRow}>
                <span>{tx.name}</span>
                <em>{tx.category}</em>
                <strong>{tx.amount}</strong>
              </div>
            ))}
          </div>
          <div className={styles.panel}>
            <h2>Alerts</h2>
            {alerts.map((alert) => (
              <div key={alert.title} className={styles.alert}>
                <strong>{alert.title}</strong>
                <span>{alert.detail}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
