import Link from "next/link";
import { Orbitron, Questrial } from "next/font/google";
import styles from "./page.module.css";
import { stats, budgets, goals, transactions, categorySplit } from "../data";

const display = Orbitron({
  weight: ["500", "700"],
  subsets: ["latin"],
  variable: "--font-display",
});

const body = Questrial({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-body",
});

export default function LabV10Page() {
  return (
    <main className={`${styles.page} ${display.variable} ${body.variable}`}>
      <header className={styles.header}>
        <Link href="/lab" className={styles.back}>
          Back to Lab
        </Link>
        <div>
          <p className={styles.kicker}>Orbital System</p>
          <h1 className={styles.title}>Orbit Your Wealth</h1>
          <p className={styles.sub}>Circular logic, radial insight, and AI at the core.</p>
        </div>
        <div className={styles.status}>
          <span>Orbit status</span>
          <strong>STABLE</strong>
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
        <div className={styles.orbitPanel}>
          <div className={styles.orbitCenter}>
            <strong>AI CORE</strong>
            <span>Budget sync</span>
          </div>
          <div className={styles.orbitRing}>
            {categorySplit.map((cat) => (
              <div key={cat.name} className={styles.orbitNode}>
                <span>{cat.name}</span>
                <strong>{cat.value}%</strong>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Budgets</h2>
            <span>Cycles</span>
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
            <span>Orbit progress</span>
          </div>
          {goals.map((goal) => (
            <div key={goal.name} className={styles.row}>
              <span>{goal.name}</span>
              <div className={styles.trackAlt}>
                <div style={{ width: `${goal.progress}%` }} />
              </div>
              <strong>{goal.progress}%</strong>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.panelWide}>
        <div className={styles.panelHeader}>
          <h2>Transactions</h2>
          <span>Flight log</span>
        </div>
        <div className={styles.txGrid}>
          {transactions.map((tx) => (
            <div key={tx.name} className={styles.txCard}>
              <p>{tx.name}</p>
              <span>{tx.category}</span>
              <strong>{tx.amount}</strong>
            </div>
          ))}
        </div>
      </section>

      <footer className={styles.dock}>
        <div className={styles.dockNav}>
          <span>Home</span>
          <span>Flow</span>
          <span>Goals</span>
          <span>Signals</span>
        </div>
        <div className={styles.dockCommand}>
          <input placeholder="Ask the core" />
        </div>
        <div className={styles.dockActions}>
          <button type="button">Notify</button>
          <button type="button">Tools</button>
        </div>
      </footer>
    </main>
  );
}
