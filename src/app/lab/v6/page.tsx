import Link from "next/link";
import { Kanit, Public_Sans } from "next/font/google";
import styles from "./page.module.css";
import { stats, budgets, goals, transactions, alerts } from "../data";

const display = Kanit({
  weight: ["500", "700"],
  subsets: ["latin"],
  variable: "--font-display",
});

const body = Public_Sans({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-body",
});

export default function LabV6Page() {
  return (
    <main className={`${styles.page} ${display.variable} ${body.variable}`}>
      <div className={styles.ribbon}>
        <Link href="/lab" className={styles.ribbonBack}>
          Lab Index
        </Link>
        <div className={styles.ribbonNav}>
          <span>Dashboard</span>
          <span>Budgets</span>
          <span>Goals</span>
          <span>Calendar</span>
        </div>
        <button className={styles.ribbonCta}>Launch AI Brief</button>
      </div>

      <header className={styles.header}>
        <p className={styles.kicker}>Kinetic Tape</p>
        <h1 className={styles.title}>Momentum Is the Interface</h1>
        <p className={styles.sub}>
          Directional ribbons, fast density, and motion-driven hierarchy.
        </p>
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
            <h2>Budget velocity</h2>
            <span>Real time</span>
          </div>
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
          <div className={styles.panelHeader}>
            <h2>Goals</h2>
            <span>Trajectory</span>
          </div>
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
      </section>

      <section className={styles.split}>
        <div className={styles.panelAlt}>
          <div className={styles.panelHeader}>
            <h2>Signal feed</h2>
            <span>Transactions</span>
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
            <h2>Alerts</h2>
            <span>Watch list</span>
          </div>
          {alerts.map((alert) => (
            <div key={alert.title} className={styles.alert}>
              <strong>{alert.title}</strong>
              <span>{alert.detail}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
