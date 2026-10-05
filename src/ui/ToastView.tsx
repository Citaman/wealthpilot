import { X } from "lucide-react";
import type { ReactNode } from "react";
import "./ToastView.css";

export interface ToastViewProps {
  message: ReactNode;
  action?: { label: string; onClick: () => void };
  onClose: () => void;
  tone?: "neutral" | "error";
}

export function ToastView({
  message,
  action,
  onClose,
  tone = "neutral",
}: ToastViewProps) {
  return (
    <div className="ui-toast" data-tone={tone}>
      <span className="ui-toast-message">{message}</span>
      {action && (
        <button
          type="button"
          className="ui-toast-action"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
      <button
        type="button"
        className="ui-toast-close"
        aria-label="Fermer"
        onClick={onClose}
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}
