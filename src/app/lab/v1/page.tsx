import Link from "next/link";
import { Rubik_Mono_One, IBM_Plex_Mono } from "next/font/google";
import styles from "./page.module.css";
import { cashflow, budgets, goals, transactions, stats, alerts } from "../data";

const display = Rubik_Mono_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

const body = IBM_Plex_Mono({
  weight: ["400", "600"],
  subsets: ["latin"],
  variable: "--font-body",
});

export default function LabV1Page() {
  return (
    <main className={`${styles.page} ${display.variable} ${body.variable}`}>
      <header className={styles.topbar}>
        <Link href="/lab" className={styles.back}>
          Back to Lab
        </Link>
        <nav className={styles.nav}>
          <span className={styles.navItem}>Overview</span>
          <span className={styles.navItem}>Budgets</span>
          <span className={styles.navItem}>Cashflow</span>
          <span className={styles.navItem}>Goals</span>
        </nav>
        <div className={styles.command}>
          <input placeholder="Ask ledger: summarize this week" />
        </div>
        <button className={styles.cta}>Add move</button>
      </header>

      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>NEO BRUTAL LEDGER</p>
          <h1 className={styles.title}>Total Control of Every Dollar</h1>
          <p className={styles.sub}>Thick lines, loud signals, no soft edges.</p>
        </div>
        <div className={styles.heroPanel}>
          <p className={styles.heroLabel}>Risk pulse</p>
          <p className={styles.heroValue}>Stable</p>
          <p className={styles.heroNote}>2 anomalies flagged</p>
        </div>
      </section>

      <section className={styles.grid}>
        <div className={styles.mainCol}>
          <div className={styles.stats}>
            {stats.map((stat) => (
              <div key={stat.label} className={styles.statCard}>
                <p className={styles.statLabel}>{stat.label}</p>
                <p className={styles.statValue}>{stat.value}</p>
                <p className={styles.statDelta}>{stat.delta}</p>
              </div>
            ))}
          </div>

          <div className={styles.blockTitle}>Cashflow barline</div>
          <div className={styles.chart}>
            {cashflow.map((value, index) => (
              <div key={`bar-${index}`} className={styles.barWrap}>
                <div className={styles.bar} style={{ height: `${value}%` }} />
              </div>
            ))}
          </div>

          <div className={styles.split}>
            <div className={styles.panel}>
              <div className={styles.panelTitle}>Budget blocks</div>
              <div className={styles.budgetGrid}>
                {budgets.map((budget) => (
                  <div key={budget.name} className={styles.budgetCard}>
                    <div className={styles.budgetHeader}>
                      <span>{budget.name}</span>
                      <span>{budget.total}</span>
                    </div>
                    <div className={styles.budgetTrack}>
                      <div className={styles.budgetFill} style={{ width: `${budget.used}%` }} />
                    </div>
                    <p className={styles.budgetNote}>{budget.used}% used</p>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.panel}>
              <div className={styles.panelTitle}>Goals</div>
              {goals.map((goal) => (
                <div key={goal.name} className={styles.goalRow}>
                  <div>
                    <p className={styles.goalName}>{goal.name}</p>
                    <p className={styles.goalTarget}>Target {goal.target}</p>
                  </div>
                  <div className={styles.goalMeter}>
                    <span style={{ width: `${goal.progress}%` }} />
                    <strong>{goal.progress}%</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className={styles.sideCol}>
          <div className={styles.panel}>
            <div className={styles.panelTitle}>Recent moves</div>
            <ul className={styles.list}>
              {transactions.map((tx) => (
                <li key={tx.name} className={styles.listItem}>
                  <div>
                    <p className={styles.listName}>{tx.name}</p>
                    <p className={styles.listMeta}>{tx.category}</p>
                  </div>
                  <span className={styles.listAmount}>{tx.amount}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.panel}>
            <div className={styles.panelTitle}>Alerts</div>
            {alerts.map((alert) => (
              <div key={alert.title} className={styles.alert}>
                <p className={styles.alertTitle}>{alert.title}</p>
                <p className={styles.alertDetail}>{alert.detail}</p>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}
