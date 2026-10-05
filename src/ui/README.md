# src/ui — Rime primitives, charts, sortable

Import once: `./fonts`, `./tokens.css`, `./base.css`. Colours only through tokens; components read the `--card-*` roles, redefined by `.palette-<CardPaletteId>` and `[data-theme="ink"]`. Amounts are cents.

## Primitives
- `Button` {variant: primary|accent|outline|ghost|danger, size: s(36)|m(44), icon, iconEnd, loading, disabledReason → aria-disabled + title} + button attrs/ref
- `IconButton` {label (required aria-label/title), icon, variant: ghost|outline|primary, disabledReason}
- `Segmented<T>` {value, onChange, options[{value, label, ariaLabel?, disabledReason?}], label, size: m|compact} — radiogroup, arrows/Home/End
- `Picker<T>` {value, onValueChange, label, options? | sections?[{label?, options}], option{value,label,description?,meta?,disabled?}, valueLabel?, footer?, side: top|bottom, align, size, variant: outline|ghost|dock, disabled, id/aria-* (from Field)}
- `Menu` {trigger, items: {label,onSelect,icon?,meta?,destructive?,disabledReason?} | {type:"separator"} | {type:"label",label}, side, align, label}
- `Popover` {trigger, label, children, side, align, open?, onOpenChange?} · `PopoverClose`
- `Dialog` {open?, onOpenChange?, trigger?, title, description?, children, footer?, size: s|m} · `DialogClose`
- `Sheet` {open?, onOpenChange?, trigger?, title, description?, toolbar?, children, footer?} — right 420px, full screen < 720px
- `Money` {value: Cents|null, tone: auto|none, size: hero|xl|l|m|s|text|inherit, signed, cents, unknownReason} — null → « — » + title
- `EditableMoney` {value: Cents|null, onCommit(next) → Promise|void, label, size, allowEmpty (empty → null), validate?}
- `EditableText` {value, onCommit, label, placeholder?, maxLength?, validate?} — Enter/Tab/blur commit, Escape cancels, error bubble, rejected promise keeps editing
- `Field` {label, hint?, error?, ...input attrs | children(control) for a custom control}
- `Disclosure` {summary, children, defaultOpen?, open?, onOpenChange?} — 180 ms grid-rows, Escape closes
- `Badge` {tone: neutral|estimated|positive|negative|new|duplicate|error|warning, title?}
- `Skeleton` {width, height, shape: text|tile|card|pill} · `Empty` {children, action?}
- `CardShell` {palette?, title? | eyebrow?, actions?, footer?, motif?, headingLevel} — `container: card`, `data-width` narrow(<360)|medium|wide(>640); `useCardWidth()` → {width, size}
- `ErrorBoundary` {label = « Cette carte », onError?} — « … n’a pas pu s’afficher · Réessayer »
- `CategoryDot` {color, size: 8|10|12|16, label?} · `MerchantLogo` {color(hex), src?, icon?: LucideIcon (default shop, never an initial), size: 28|32|44}
- `ProgressBar` {paid, committed?, total, color, label, showPercent} — hatched committed, over-budget tick
- `DateChip` {date, soon?} · `ToastView` {message, action?{label,onClick}, onClose, tone: neutral|error}
- `useMeasure<T>()` → [ref, {width, height}]

## Charts (`charts/`, pure SVG, measured)
- `scales.ts`: `linearScale`, `niceTicks(min,max,count≈4)`, `dateScale(from,to,range)`, `dateTicks(from,to,width)`, `axisEuro`
- `annotations.ts`: `placeAnnotations(anchors, {bounds, obstacles, maxWidth})` greedy collision boxes, `truncate`
- `LineChart` {series[{id,label,points[{date,value|null}],kind: observed|forecast|context,color?}], band?[{date,low,high}], threshold?{value,label}, today?, annotations?(≤4), height?, label, describe?(date), onSelect?(date)} — slider role: ←/→/Home/End, Enter; hidden table
- `DivergingBars` {data[{key,label,title?,income,spending,incomplete?}], label, onSelect?(key), height?}
- `ConcentricRings` {rings[{key,label,value,max,color}] ≤5, label, center?, activeIndex?, onActiveChange?, size=280}
- `SegmentBar` {paid, committed, possible, label, legend=true} · `Sparkline` {values (null = gap), label, height}
- `DayStrip` {days[{date,spent?,charges?,incomes?[{label,amount,estimated?}],endBalance?}], label, today?, selected?, onSelect?} — list < 560px
- `Waterfall` {rows[{key,label,value,kind: base|step|total,amount?: node,detail?: node}], label}

## Sortable (`sortable.ts`)
`useSortable<T>({ids, onCommit(next), axis: "grid"|"y", label(id), disabled?})` → `{order, activeId, getItemProps(id), getHandleProps(id), placeholder, status, announcement}`.
Spread item props on the cell, handle props on a `<button>`; render `placeholder` and `status` once. Pointer: lift on handle, exact grab offset, frozen size, dashed fixed placeholder, FLIP 180 ms, nearest-centre insertion with 12 px hysteresis, rAF auto-scroll at 80 px from top / from `--dock-h`, follows on scroll, Escape/pointercancel restore. Keyboard: Space/Enter lift/drop, arrows move, Escape cancel, French live announcements. `moveItem(ids, id, toIndex)` for menu actions.
