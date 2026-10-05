import {
  createContext,
  useContext,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import type { CardPaletteId } from "../domain/types";
import { useMeasure } from "./useMeasure";
import "./CardShell.css";

export type CardWidthClass = "narrow" | "medium" | "wide";

export const widthClass = (px: number): CardWidthClass =>
  px < 360 ? "narrow" : px <= 640 ? "medium" : "wide";

const CardWidthContext = createContext<{ width: number; size: CardWidthClass }>(
  {
    width: 0,
    size: "medium",
  },
);

/** Measured width of the enclosing CardShell. */
export const useCardWidth = () => useContext(CardWidthContext);

export interface CardShellProps
  extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  palette?: CardPaletteId;
  title?: ReactNode;
  /** Mono uppercase label used instead of a title on dark hero cards. */
  eyebrow?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  headingLevel?: 2 | 3;
  /** Pink/cyan discs cut by the corner — one hero card per screen at most. */
  motif?: boolean;
  children?: ReactNode;
}

export function CardShell({
  palette,
  title,
  eyebrow,
  actions,
  footer,
  headingLevel = 2,
  motif = false,
  className,
  children,
  ...rest
}: CardShellProps) {
  const [ref, { width }] = useMeasure<HTMLElement>();
  const size = width ? widthClass(width) : "medium";
  const Heading = `h${headingLevel}` as const;
  const hasHeader = title || eyebrow || actions;
  return (
    <section
      ref={ref}
      className={["ui-card", palette && `palette-${palette}`, className]
        .filter(Boolean)
        .join(" ")}
      data-width={width ? size : undefined}
      {...rest}
    >
      {motif && <span className="ui-card-motif" aria-hidden />}
      <div className="ui-card-body">
        {hasHeader && (
          <header className="ui-card-header">
            {title ? (
              <Heading className="ui-card-title">{title}</Heading>
            ) : eyebrow ? (
              <Heading className="ui-card-eyebrow eyebrow">{eyebrow}</Heading>
            ) : (
              <span />
            )}
            {actions && <div className="ui-card-actions">{actions}</div>}
          </header>
        )}
        <CardWidthContext.Provider value={{ width, size }}>
          {children}
        </CardWidthContext.Provider>
        {footer && <footer className="ui-card-footer">{footer}</footer>}
      </div>
    </section>
  );
}
