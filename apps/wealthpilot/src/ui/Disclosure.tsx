import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import "./Disclosure.css";

export interface DisclosureProps {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  open: controlled,
  onOpenChange,
  className,
}: DisclosureProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const open = controlled ?? uncontrolled;
  const id = useId();
  const toggle = () => {
    setUncontrolled(!open);
    onOpenChange?.(!open);
  };
  return (
    <div
      className={["ui-disclosure", className].filter(Boolean).join(" ")}
      data-open={open}
    >
      <button
        type="button"
        className="ui-disclosure-button"
        aria-expanded={open}
        aria-controls={id}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            event.stopPropagation();
            toggle();
          }
        }}
      >
        {summary}
        <ChevronDown className="ui-disclosure-chevron" size={16} aria-hidden />
      </button>
      <div id={id} role="region" className="ui-disclosure-panel">
        <div className="ui-disclosure-inner">
          <div className="ui-disclosure-content">{children}</div>
        </div>
      </div>
    </div>
  );
}
