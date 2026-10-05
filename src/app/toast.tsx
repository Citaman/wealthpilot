import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export interface ToastInput {
  message: string;
  /** Shown as a button, typically « Annuler ». Runs at most once. */
  action?: { label: string; run(): unknown };
  tone?: "neutral" | "error";
  /** Errors stay until dismissed. */
  persistent?: boolean;
}
export interface Toast extends ToastInput {
  id: number;
}

interface ToastApi {
  show(toast: ToastInput): void;
  /** Shows « message · Annuler » for an undoable command. */
  undoable(message: string, undo: (() => unknown) | void): void;
  error(error: unknown): void;
}

const ToastContext = createContext<ToastApi | null>(null);
const ToastList = createContext<{
  toasts: Toast[];
  dismiss(id: number): void;
} | null>(null);

const DURATION = 6000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const api = useMemo<ToastApi>(() => {
    const show = (input: ToastInput) => {
      const toast = { ...input, id: nextId.current++ };
      // One message at a time: a new action supersedes the previous one.
      setToasts([toast]);
    };
    return {
      show,
      undoable(message, undo) {
        show(
          undo
            ? { message, action: { label: "Annuler", run: undo } }
            : { message },
        );
      },
      error(error) {
        const message = error instanceof Error ? error.message : String(error);
        show({ message, tone: "error", persistent: true });
      },
    };
  }, []);

  const list = useMemo(() => ({ toasts, dismiss }), [toasts, dismiss]);
  return (
    <ToastContext.Provider value={api}>
      <ToastList.Provider value={list}>{children}</ToastList.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast outside ToastProvider");
  return api;
}

/** Current toasts and auto-dismiss timers, for the renderer in the shell. */
export function useToastList() {
  const list = useContext(ToastList);
  if (!list) throw new Error("useToastList outside ToastProvider");
  const { toasts, dismiss } = list;
  useEffect(() => {
    const timers = toasts
      .filter((t) => !t.persistent)
      .map((t) => setTimeout(() => dismiss(t.id), DURATION));
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismiss]);
  return list;
}
