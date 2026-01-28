import Link from "next/link";
import styles from "./page.module.css";
import { labVariants } from "./variants";

export default function LabIndexPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>WealthPilot Lab</p>
          <h1 className={styles.title}>Dashboard Visual Systems</h1>
          <p className={styles.subtitle}>
            Ten full redesign directions. Each route is self-contained with unique typography,
            palette, layout, and component language.
          </p>
        </div>
        <div className={styles.metaCard}>
          <div>
            <p className={styles.metaLabel}>Scope</p>
            <p className={styles.metaValue}>Dashboard only</p>
          </div>
          <div>
            <p className={styles.metaLabel}>Goal</p>
            <p className={styles.metaValue}>Select one to roll out across the app</p>
          </div>
          <div>
            <p className={styles.metaLabel}>Nav split</p>
            <p className={styles.metaValue}>5 bottom dock, 5 alternatives</p>
          </div>
        </div>
      </header>

      <section className={styles.grid}>
        {labVariants.map((variant) => (
          <Link key={variant.id} href={variant.path} className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardId}>{variant.id.toUpperCase()}</span>
              <span className={styles.cardNav}>{variant.nav}</span>
            </div>
            <h2 className={styles.cardTitle}>{variant.name}</h2>
            <p className={styles.cardSummary}>{variant.summary}</p>
            <div className={styles.tagRow}>
              {variant.tags.map((tag) => (
                <span key={tag} className={styles.tag}>
                  {tag}
                </span>
              ))}
            </div>
            <span className={styles.cardLink}>Open variant</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
