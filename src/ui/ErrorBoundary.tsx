import { Component, type ErrorInfo, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "./Button";
import "./ErrorBoundary.css";

export interface ErrorBoundaryProps {
  /** Subject of the fallback sentence: « Cette carte », « Cette page ». */
  label?: string;
  children: ReactNode;
  onError?: (error: unknown, info: ErrorInfo) => void;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="ui-error-fallback" role="alert">
        <span>{this.props.label ?? "Cette carte"} n’a pas pu s’afficher</span>
        <span aria-hidden>·</span>
        <Button
          variant="ghost"
          icon={<RotateCcw aria-hidden />}
          onClick={() => this.setState({ failed: false })}
        >
          Réessayer
        </Button>
      </div>
    );
  }
}
