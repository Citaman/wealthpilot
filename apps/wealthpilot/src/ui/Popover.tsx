import * as RadixPopover from "@radix-ui/react-popover";
import type { ReactElement, ReactNode } from "react";
import "./Popover.css";

export interface PopoverProps {
  trigger: ReactElement;
  children: ReactNode;
  label: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export function Popover({
  trigger,
  children,
  label,
  side = "bottom",
  align = "start",
  open,
  onOpenChange,
  className,
}: PopoverProps) {
  return (
    <RadixPopover.Root open={open} onOpenChange={onOpenChange}>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          side={side}
          align={align}
          sideOffset={8}
          collisionPadding={8}
          aria-label={label}
          className={["ui-float ui-popover", className]
            .filter(Boolean)
            .join(" ")}
        >
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}

export const PopoverClose = RadixPopover.Close;
