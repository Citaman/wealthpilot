import Link from "next/link";
import { Fira_Sans, Fira_Sans_Extra_Condensed } from "next/font/google";
import styles from "./page.module.css";
import { stats, budgets, goals, transactions, categorySplit } from "../data";

const display = Fira_Sans_Extra_Condensed({
  weight: ["600", "700"],
  subsets: ["latin"],
  variable: "--font-display",
});

const body = Fira_Sans({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-body",
});

export default function LabV5Page() {
  return (
    <main className={`${styles.page} ${display.variable} ${body.variable}`}>
      <header className={styles.header}>
        <Link href="/lab" className={styles.back}>
          Back to Lab
        </Link>
        <div>
          <p className={styles.kicker}>Bauhaus Blocks</p>
          <h1 className={styles.title}>Primary Shapes, Primary Signals</h1>
        </div>
        <div className={styles.headerBlock}>
          <span>Monthly status</span>
          <strong>CALM</strong>
        </div>
      </header>

      <section className={styles.stats}>
        {stats.map((stat, index) => (
          <div key={stat.label} className={`${styles.statCard} ${styles[`tone${index}`]}`}>
            <p>{stat.label}</p>
            <h3>{stat.value}</h3>
            <span>{stat.delta}</span>
          </div>
        ))}
      </section>

      <section className={styles.grid}>
        <div className={styles.block}>
          <div className={styles.blockHeader}>
            <h2>Category blocks</h2>
            <span>Share</span>
          </div>
          <div className={styles.blockGrid}>
            {categorySplit.map((cat, index) => (
              <div key={cat.name} className={`${styles.catBlock} ${styles[`cat${index}`]}`}>
                <span>{cat.name}</span>
                <strong>{cat.value}%</strong>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.block}>
          <div className={styles.blockHeader}>
            <h2>Budgets</h2>
            <span>Limits</span>
          </div>
          {budgets.map((budget) => (
            <div key={budget.name} className={styles.budgetRow}>
              <span>{budget.name}</span>
              <div className={styles.bar}>
                <div style={{ width: `${budget.used}%` }} />
              </div>
              <strong>{budget.used}%</strong>
            </div>
          ))}
        </div>

        <div className={styles.block}>
          <div className={styles.blockHeader}>
            <h2>Goals</h2>
            <span>Progress</span>
          </div>
          {goals.map((goal) => (
            <div key={goal.name} className={styles.goalRow}>
              <div>
                <p>{goal.name}</p>
                <span>{goal.target}</span>
              </div>
              <div className={styles.goalBar}>
                <div style={{ width: `${goal.progress}%` }} />
              </div>
              <strong>{goal.progress}%</strong>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.block}>
        <div className={styles.blockHeader}>
          <h2>Recent transactions</h2>
          <span>Stream</span>
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
          <span>Budgets</span>
          <span>Goals</span>
          <span>Insights</span>
        </div>
        <div className={styles.dockCommand}>
          <input placeholder="Ask Bauhaus AI" />
        </div>
        <div className={styles.dockActions}>
          <button type="button">Notify</button>
          <button type="button">Quick</button>
        </div>
      </footer>
    </main>
  );
}
