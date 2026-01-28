import Link from "next/link";
import { Share_Tech_Mono, JetBrains_Mono } from "next/font/google";
import styles from "./page.module.css";
import { stats, budgets, goals, transactions, alerts, cashflow } from "../data";

const display = Share_Tech_Mono({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

const body = JetBrains_Mono({
  weight: ["400", "600"],
  subsets: ["latin"],
  variable: "--font-body",
});

export default function LabV4Page() {
  return (
    <main className={`${styles.page} ${display.variable} ${body.variable}`}>
      <header className={styles.header}>
        <Link href="/lab" className={styles.back}>
          BACK
        </Link>
        <div>
          <p className={styles.kicker}>Terminal Finance</p>
          <h1 className={styles.title}>Command Grade Cash Ops</h1>
        </div>
        <div className={styles.status}>
          <span>SYS</span>
          <strong>GREEN</strong>
        </div>
      </header>

      <section className={styles.console}>
        <div className={styles.sectionTitle}>LIVE METRICS</div>
        <div className={styles.stats}>
          {stats.map((stat) => (
            <div key={stat.label} className={styles.statCard}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <em>{stat.delta}</em>
            </div>
          ))}
        </div>

        <div className={styles.sectionTitle}>CASHFLOW SIGNAL</div>
        <div className={styles.signal}>
          {cashflow.map((value, index) => (
            <div key={`signal-${index}`} className={styles.tick}>
              <div style={{ height: `${value}%` }} />
            </div>
          ))}
        </div>

        <div className={styles.grid}>
          <div className={styles.panel}>
            <div className={styles.panelTitle}>BUDGET MATRIX</div>
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
            <div className={styles.panelTitle}>GOAL INDEX</div>
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
      </section>

      <section className={styles.feed}>
        <div className={styles.panel}>
          <div className={styles.panelTitle}>TX STREAM</div>
          {transactions.map((tx) => (
            <div key={tx.name} className={styles.txRow}>
              <span>{tx.name}</span>
              <em>{tx.category}</em>
              <strong>{tx.amount}</strong>
            </div>
          ))}
        </div>
        <div className={styles.panel}>
          <div className={styles.panelTitle}>ALERT LOG</div>
          {alerts.map((alert) => (
            <div key={alert.title} className={styles.alert}>
              <strong>{alert.title}</strong>
              <span>{alert.detail}</span>
            </div>
          ))}
        </div>
      </section>

      <footer className={styles.dock}>
        <div className={styles.dockLeft}>NAV 01 02 03 04</div>
        <div className={styles.dockCenter}>
          <input placeholder="run audit --month" />
          <div className={styles.shortcuts}>
            <span>F1 help</span>
            <span>F2 anomalies</span>
            <span>F3 export</span>
          </div>
        </div>
        <div className={styles.dockRight}>
          <button type="button">ALERTS</button>
          <button type="button">TOOLS</button>
        </div>
      </footer>
    </main>
  );
}
