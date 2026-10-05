import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { ReactElement, ReactNode } from "react";
import "./Menu.css";

export type MenuEntry =
  | {
      type?: "item";
      label: string;
      onSelect: () => void;
      icon?: ReactNode;
      meta?: string;
      destructive?: boolean;
      disabledReason?: string;
    }
  | { type: "separator" }
  | { type: "label"; label: string };

export interface MenuProps {
  /** A single focusable element, typically a Button or IconButton. */
  trigger: ReactElement;
  items: readonly MenuEntry[];
  side?: "top" | "bottom";
  align?: "start" | "center" | "end";
  label?: string;
}

export function Menu({
  trigger,
  items,
  side = "bottom",
  align = "end",
  label,
}: MenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side={side}
          align={align}
          sideOffset={8}
          collisionPadding={8}
          aria-label={label}
          className="ui-float ui-menu"
        >
          {items.map((entry, index) => {
            if (entry.type === "separator")
              return (
                <DropdownMenu.Separator
                  key={index}
                  className="ui-float-separator"
                />
              );
            if (entry.type === "label")
              return (
                <DropdownMenu.Label key={index} className="ui-float-label">
                  {entry.label}
                </DropdownMenu.Label>
              );
            return (
              <DropdownMenu.Item
                key={index}
                className="ui-float-item ui-menu-item"
                data-destructive={entry.destructive || undefined}
                disabled={Boolean(entry.disabledReason)}
                title={entry.disabledReason}
                onSelect={entry.onSelect}
              >
                {entry.icon && (
                  <span className="ui-menu-icon">{entry.icon}</span>
                )}
                <span className="ui-menu-label">{entry.label}</span>
                {entry.meta && (
                  <span className="ui-menu-meta">{entry.meta}</span>
                )}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
