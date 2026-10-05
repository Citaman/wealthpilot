import * as Dialog from "@radix-ui/react-dialog";
import { X, ArrowUpRight } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content
          className={"modal " + (wide ? "wide" : "")}
          aria-describedby={undefined}
        >
          <header>
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close className="icon-button" aria-label="Fermer">
              <X size={20} />
            </Dialog.Close>
          </header>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function InlinePanel({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const title = heading.current;
    const section = title?.closest(".inline-panel");
    // Nested panels keep the more specific child's focus; hidden pages never steal it.
    if (
      !title ||
      title.closest("[hidden]") ||
      (document.activeElement?.tagName === "H1" &&
        title.closest("main")?.contains(document.activeElement)) ||
      section?.contains(document.activeElement)
    )
      return;
    title.focus({ preventScroll: true });
  }, []);
  return (
    <section className="inline-panel" aria-label={title}>
      <header>
        <h2 ref={heading} tabIndex={-1}>
          {title}
        </h2>
        <button className="icon-button" aria-label="Fermer" onClick={onClose}>
          <X size={20} />
        </button>
      </header>
      {children}
    </section>
  );
}
export function Empty({
  title,
  children,
  action,
  onAction,
}: {
  title: string;
  children?: ReactNode;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty">
      <span className="empty-mark">↗</span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action && (
        <button className="button dark" onClick={onAction}>
          {action}
          <ArrowUpRight size={16} />
        </button>
      )}
    </div>
  );
}
export { MerchantIcon } from "./MerchantIcon";
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={"notice " + (error ? "error" : "")}
      role={error ? "alert" : undefined}
    >
      {children}
    </div>
  );
}
