import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { IconButton } from "../../ui/IconButton";
import { Picker } from "../../ui/Picker";
import { pageSizes } from "./state";

export interface PaginationProps {
  /** 0-based. */
  page: number;
  pageSize: number;
  total: number;
  onPage(page: number): void;
  onPageSize(size: number): void;
  position: "haut" | "bas";
}

const nf = new Intl.NumberFormat("fr-FR");

/** 1-based page numbers with `null` for an ellipsis; first and last always shown. */
export function pageWindow(page: number, count: number): (number | null)[] {
  const current = page + 1;
  const pages = new Set([1, count, current - 1, current, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (current >= count - 2) [count - 3, count - 2, count - 1].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  for (const p of sorted) {
    const prev = out.at(-1);
    if (typeof prev === "number" && p - prev === 2) out.push(p - 1);
    else if (typeof prev === "number" && p - prev > 2) out.push(null);
    out.push(p);
  }
  return out;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
  position,
}: PaginationProps) {
  const count = Math.max(1, Math.ceil(total / pageSize));
  const first = page * pageSize + 1;
  const last = Math.min(total, (page + 1) * pageSize);
  const [jump, setJump] = useState("");

  const go = () => {
    const n = Number.parseInt(jump, 10);
    if (Number.isFinite(n)) onPage(Math.min(count, Math.max(1, n)) - 1);
    setJump("");
  };

  return (
    <nav className="tx-pager" aria-label={`Pagination (${position})`}>
      <span className="tx-pager-range" aria-live={position === "haut" ? "polite" : undefined}>
        {nf.format(first)}–{nf.format(last)} <span className="muted">sur</span>{" "}
        {nf.format(total)}
      </span>
      <Picker
        label="Lignes par page"
        size="compact"
        variant="ghost"
        value={String(pageSize)}
        valueLabel={`${pageSize} lignes`}
        onValueChange={(v) => onPageSize(Number(v))}
        options={pageSizes.map((size) => ({
          value: String(size),
          label: `${size} lignes`,
        }))}
      />
      {count > 1 && (
        <>
          <ol className="tx-pages">
            <li>
              <IconButton
                label="Page précédente"
                icon={<ChevronLeft aria-hidden />}
                disabledReason={page === 0 ? "Première page" : undefined}
                onClick={() => onPage(page - 1)}
              />
            </li>
            {pageWindow(page, count).map((p, i) =>
              p === null ? (
                <li key={`gap${i}`} className="tx-page-gap" aria-hidden>
                  …
                </li>
              ) : (
                <li key={p} className="tx-page-item">
                  <button
                    type="button"
                    className="tx-page"
                    aria-current={p === page + 1 ? "page" : undefined}
                    aria-label={`Page ${p}`}
                    onClick={() => onPage(p - 1)}
                  >
                    {p}
                  </button>
                </li>
              ),
            )}
            <li className="tx-page-mobile" aria-hidden>
              {page + 1} / {count}
            </li>
            <li>
              <IconButton
                label="Page suivante"
                icon={<ChevronRight aria-hidden />}
                disabledReason={page === count - 1 ? "Dernière page" : undefined}
                onClick={() => onPage(page + 1)}
              />
            </li>
          </ol>
          <label className="tx-jump">
            <span>Aller à</span>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder={String(page + 1)}
              aria-label={`Aller à la page (1 à ${count})`}
              value={jump}
              onChange={(event) =>
                setJump(event.currentTarget.value.replace(/\D/g, ""))
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  go();
                }
              }}
            />
          </label>
        </>
      )}
    </nav>
  );
}
