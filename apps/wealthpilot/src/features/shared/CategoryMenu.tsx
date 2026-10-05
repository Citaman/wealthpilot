import { Check, ChevronRight, Plus, Search } from "lucide-react";
import {
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  categoryNames,
  isUncategorized,
  subcategoryNames,
} from "../../domain/categories";
import type { Ledger } from "../../domain/ledger";
import { normalize } from "../../domain/search";
import { Popover } from "../../ui/Popover";
import { CategoryIcon } from "./CategoryLabel";
import "./CategoryMenu.css";

export interface CategoryMenuProps {
  ledger: Ledger;
  /** Current category name. */
  value: string;
  /** Current subcategory, checked in the list. */
  subcategory?: string;
  /** Up to 3 quick choices shown first (e.g. domain suggestCategories). */
  suggestions?: string[];
  onSelect(category: string, subcategory?: string): void;
  /** The element that opens the menu (rendered as-is, must be a button). */
  trigger: ReactNode;
  /** Expense or income categories first. */
  direction?: "expense" | "income";
}

export function CategoryMenu({
  ledger,
  value,
  subcategory,
  suggestions,
  onSelect,
  trigger,
  direction,
}: CategoryMenuProps) {
  const [open, setOpen] = useState(false);
  if (!isValidElement(trigger)) return <>{trigger}</>;
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={trigger as ReactElement}
      label="Choisir une catégorie"
      className="cat-menu"
    >
      <CategoryList
        ledger={ledger}
        value={value}
        subcategory={subcategory}
        suggestions={suggestions ?? []}
        direction={direction}
        onPick={(category, subcategory) => {
          setOpen(false);
          rememberRecent(category);
          onSelect(category, subcategory);
        }}
      />
    </Popover>
  );
}

const RECENT_KEY = "wealthpilot-recent-categories";

function readRecent(): string[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(list)
      ? list.filter((c): c is string => typeof c === "string")
      : [];
  } catch {
    return [];
  }
}

function rememberRecent(category: string) {
  try {
    localStorage.setItem(
      RECENT_KEY,
      JSON.stringify(
        [category, ...readRecent().filter((c) => c !== category)].slice(0, 5),
      ),
    );
  } catch {
    // Private mode: recents are a convenience only.
  }
}

interface Option {
  key: string;
  section: string;
  category: string;
  subcategory?: string;
  /** A new category, a new subcategory (with subcategory), or « type one » (empty). */
  create?: boolean;
  hasChildren?: boolean;
}

/** « Food › Drive », « Food / Drive » or « Food > Drive ». */
function splitPath(query: string) {
  const [category, ...rest] = query.split(/\s*[›/>]\s*/);
  return rest.length
    ? { category: category.trim(), subcategory: rest.join(" ").trim() }
    : null;
}

const signs = new WeakMap<Ledger, Map<string, number>>();
/** Positive when a category is mostly used for incomes. */
function categorySign(ledger: Ledger) {
  let map = signs.get(ledger);
  if (!map) {
    map = new Map();
    for (const t of ledger.transactions)
      map.set(t.category, (map.get(t.category) ?? 0) + Math.sign(t.amount));
    signs.set(ledger, map);
  }
  return map;
}

function CategoryList({
  ledger,
  value,
  subcategory,
  suggestions,
  direction,
  onPick,
}: {
  ledger: Ledger;
  value: string;
  subcategory?: string;
  suggestions: string[];
  direction?: "expense" | "income";
  onPick(category: string, subcategory?: string): void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(value && !isUncategorized(value) ? [value] : []),
  );
  const [active, setActive] = useState(0);
  const recent = useMemo(readRecent, []);

  const options = useMemo<Option[]>(() => {
    const sign = categorySign(ledger);
    const wanted = direction === "income" ? 1 : -1;
    const all = categoryNames(ledger).toSorted((a, b) =>
      direction
        ? Number(Math.sign(sign.get(b) ?? 0) === wanted) -
            Number(Math.sign(sign.get(a) ?? 0) === wanted) ||
          a.localeCompare(b, "fr")
        : 0,
    );
    const path = splitPath(query);
    if (path) {
      const category =
        all.find((c) => normalize(c) === normalize(path.category)) ??
        path.category;
      const subs = category ? subcategoryNames(ledger, category) : [];
      const q = normalize(path.subcategory);
      const matches: Option[] = subs
        .filter((sub) => normalize(sub).includes(q))
        .map((sub) => ({
          key: `p:${category}/${sub}`,
          section: "",
          category,
          subcategory: sub,
        }));
      const exact = subs.some((sub) => normalize(sub) === q);
      return category && q && !exact && !isUncategorized(category)
        ? [
            ...matches,
            {
              key: "create-sub",
              section: "",
              category,
              subcategory: path.subcategory,
              create: true,
            },
          ]
        : matches;
    }
    const q = normalize(query);
    if (q) {
      const matches: Option[] = [];
      for (const category of all) {
        const hit = normalize(category).includes(q);
        if (hit) matches.push({ key: `m:${category}`, section: "", category });
        for (const sub of subcategoryNames(ledger, category))
          if (hit || normalize(sub).includes(q))
            matches.push({
              key: `m:${category}/${sub}`,
              section: "",
              category,
              subcategory: sub,
            });
      }
      if (isUncategorized(query)) return matches;
      const parents = [
        ...new Set([...(isUncategorized(value) ? [] : [value]), ...expanded]),
      ].filter(
        (c) =>
          all.includes(c) &&
          !subcategoryNames(ledger, c).some((sub) => normalize(sub) === q),
      );
      return [
        ...matches,
        ...(all.some((c) => normalize(c) === q)
          ? []
          : [
              {
                key: "create",
                section: "",
                category: query.trim(),
                create: true,
              },
            ]),
        ...parents.map((category) => ({
          key: `create-sub:${category}`,
          section: "",
          category,
          subcategory: query.trim(),
          create: true,
        })),
      ];
    }
    const known = new Set(all);
    const quick = [...new Set(suggestions)].filter((c) => known.has(c));
    const recents = recent
      .filter((c) => known.has(c) && !quick.includes(c))
      .slice(0, 4);
    return [
      ...quick.map((category) => ({
        key: `s:${category}`,
        section: "Suggestions",
        category,
      })),
      ...recents.map((category) => ({
        key: `r:${category}`,
        section: "Récentes",
        category,
      })),
      ...all.flatMap((category) => {
        const subs = subcategoryNames(ledger, category);
        return [
          {
            key: `a:${category}`,
            section: "Toutes",
            category,
            hasChildren: subs.length > 0,
          },
          ...(expanded.has(category)
            ? [
                ...subs.map((sub) => ({
                  key: `a:${category}/${sub}`,
                  section: "Toutes",
                  category,
                  subcategory: sub,
                })),
                {
                  key: `a:${category}/+`,
                  section: "Toutes",
                  category,
                  subcategory: "",
                  create: true,
                },
              ]
            : []),
        ];
      }),
      { key: "new", section: "Toutes", category: "", create: true },
    ];
  }, [ledger, query, suggestions, recent, expanded, direction, value]);

  const current = Math.min(active, options.length - 1);
  const activeOption = options[current];

  useEffect(() => {
    list.current
      ?.querySelector(`[data-index="${current}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [current]);

  const choose = (option: Option) => {
    if (option.create && !option.category) {
      setCreating(true);
      input.current?.focus();
      return;
    }
    if (option.create && option.subcategory === "") {
      setQuery(`${option.category} › `);
      setActive(0);
      input.current?.focus();
      return;
    }
    onPick(option.category, option.subcategory);
  };

  const toggle = (category: string, open: boolean) =>
    setExpanded((set) => {
      const next = new Set(set);
      if (open) next.add(category);
      else next.delete(category);
      return next;
    });

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const last = options.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: Math.min(current + 1, last),
      ArrowUp: Math.max(current - 1, 0),
      PageDown: Math.min(current + 8, last),
      PageUp: Math.max(current - 8, 0),
    };
    if (event.key in moves) {
      event.preventDefault();
      setActive(moves[event.key]);
    } else if (event.key === "Enter" && activeOption) {
      event.preventDefault();
      choose(activeOption);
    } else if (
      activeOption?.hasChildren &&
      !query &&
      (event.key === "ArrowRight" || event.key === "ArrowLeft")
    ) {
      event.preventDefault();
      toggle(activeOption.category, event.key === "ArrowRight");
    }
  };

  const optionId = (index: number) => `${id}-o${index}`;
  let previousSection: string | null = null;

  return (
    <div className="cat-menu-body">
      <div className="cat-menu-search">
        <Search size={16} aria-hidden />
        <input
          ref={input}
          role="combobox"
          aria-expanded
          aria-controls={`${id}-list`}
          aria-activedescendant={activeOption ? optionId(current) : undefined}
          aria-autocomplete="list"
          aria-label="Rechercher ou créer une catégorie"
          placeholder={
            creating
              ? "Nom de la catégorie"
              : "Rechercher, ou Catégorie › Sous-cat."
          }
          value={query}
          maxLength={60}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      <ul
        ref={list}
        id={`${id}-list`}
        role="listbox"
        aria-label="Catégories"
        className="cat-menu-list"
      >
        {options.length === 0 && (
          <li className="cat-menu-none">Aucune catégorie</li>
        )}
        {options.map((option, index) => {
          const heading =
            option.section && option.section !== previousSection
              ? option.section
              : null;
          previousSection = option.section;
          const selected =
            !option.create &&
            option.category === value &&
            (option.subcategory ?? "") === (subcategory ?? "") &&
            !option.key.startsWith("s:") &&
            !option.key.startsWith("r:");
          return (
            <OptionRow
              key={option.key}
              heading={heading}
              id={optionId(index)}
              index={index}
              active={index === current}
              selected={selected}
              expanded={expanded.has(option.category)}
              option={option}
              ledger={ledger}
              onHover={() => setActive(index)}
              onChoose={() => choose(option)}
              onToggle={() =>
                toggle(option.category, !expanded.has(option.category))
              }
            />
          );
        })}
      </ul>
    </div>
  );
}

function OptionRow({
  heading,
  id,
  index,
  active,
  selected,
  expanded,
  option,
  ledger,
  onHover,
  onChoose,
  onToggle,
}: {
  heading: string | null;
  id: string;
  index: number;
  active: boolean;
  selected: boolean;
  expanded: boolean;
  option: Option;
  ledger: Ledger;
  onHover(): void;
  onChoose(): void;
  onToggle(): void;
}) {
  let content: ReactNode;
  if (option.create && option.subcategory !== undefined)
    content = (
      <>
        <Plus size={14} aria-hidden className="cat-menu-plus" />
        <span className="cat-menu-name">
          {option.subcategory
            ? `Nouvelle sous-catégorie « ${option.subcategory} »`
            : "Nouvelle sous-catégorie…"}
        </span>
        {option.subcategory && (
          <span className="cat-menu-parent">{option.category}</span>
        )}
      </>
    );
  else if (option.create)
    content = (
      <>
        <Plus size={14} aria-hidden className="cat-menu-plus" />
        <span className="cat-menu-name">
          {option.category
            ? `Nouvelle catégorie « ${option.category} »`
            : "Nouvelle catégorie…"}
        </span>
      </>
    );
  else if (option.subcategory)
    content = (
      <>
        <span className="cat-menu-branch" aria-hidden />
        <span className="cat-menu-name">{option.subcategory}</span>
        {option.section === "" && (
          <span className="cat-menu-parent">{option.category}</span>
        )}
      </>
    );
  else
    content = (
      <>
        <CategoryIcon ledger={ledger} category={option.category} size="s" />
        <span className="cat-menu-name">{option.category}</span>
        {option.hasChildren && (
          <span
            className="cat-menu-expand"
            data-open={expanded || undefined}
            title={expanded ? "Masquer les sous-catégories" : "Sous-catégories"}
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
          >
            <ChevronRight size={14} aria-hidden />
          </span>
        )}
      </>
    );
  return (
    <>
      {heading && (
        <li role="presentation" className="cat-menu-heading">
          {heading}
        </li>
      )}
      <li
        id={id}
        role="option"
        aria-selected={active}
        aria-current={selected || undefined}
        data-index={index}
        data-active={active || undefined}
        data-sub={option.subcategory !== undefined || undefined}
        className="cat-menu-option"
        onMouseMove={active ? undefined : onHover}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onChoose}
      >
        {content}
        {selected && <Check size={14} aria-hidden className="cat-menu-check" />}
      </li>
    </>
  );
}
