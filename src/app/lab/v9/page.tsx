import Link from "next/link";
import { Alegreya, Alegreya_Sans } from "next/font/google";
import styles from "./page.module.css";
import { stats, budgets, goals, transactions, cashflow } from "../data";

const display = Alegreya({
  weight: ["500", "700"],
  subsets: ["latin"],
  variable: "--font-display",
});

const body = Alegreya_Sans({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-body",
});

export default function LabV9Page() {
  return (
    <main className={`${styles.page} ${display.variable} ${body.variable}`}>
      <div className={styles.commandBar}>
        <Link href="/lab" className={styles.back}>
          Lab Index
        </Link>
        <input placeholder="Search terrain of your finances" />
        <button type="button">Run map</button>
      </div>

      <header className={styles.header}>
        <p className={styles.kicker}>Topographic Data</p>
        <h1 className={styles.title}>Layer the Terrain</h1>
        <p className={styles.sub}>Contours and depth-first visuals for category dominance.</p>
      </header>

      <section className={styles.stats}>
        {stats.map((stat) => (
          <div key={stat.label} className={styles.statCard}>
            <p>{stat.label}</p>
            <strong>{stat.value}</strong>
            <span>{stat.delta}</span>
          </div>
        ))}
      </section>

      <section className={styles.grid}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Contour cashflow</h2>
            <span>Elevation</span>
          </div>
          <div className={styles.contourChart}>
            {cashflow.map((value, index) => (
              <div key={`contour-${index}`} style={{ height: `${value}%` }} />
            ))}
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Budget strata</h2>
            <span>Layers</span>
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
      </section>

      <section className={styles.split}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Goals ridge</h2>
            <span>Long climb</span>
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

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Transactions</h2>
            <span>Footprints</span>
          </div>
          {transactions.map((tx) => (
            <div key={tx.name} className={styles.txRow}>
              <span>{tx.name}</span>
              <em>{tx.category}</em>
              <strong>{tx.amount}</strong>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
