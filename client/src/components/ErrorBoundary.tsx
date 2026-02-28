import { cn } from "@/lib/utils";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /**
   * Short label shown in the inline error card, e.g. "Data Preview" or "Analysis Chart".
   * When omitted the component falls back to the full-screen error view (app root usage).
   */
  label?: string;
  /** Optional custom fallback — overrides both inline card and full-screen views. */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      `[ErrorBoundary]${this.props.label ? ` [${this.props.label}]` : ""} crashed:`,
      error.message,
      info.componentStack
    );
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback always wins
      if (this.props.fallback) return this.props.fallback;

      const msg = this.state.error?.message ?? "An unexpected error occurred.";

      // ── Inline / section-level error card ──────────────────────────────────
      if (this.props.label) {
        return (
          <div className="flex flex-col items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-700">
                  {this.props.label} failed to render
                </p>
                <p className="text-red-600 mt-0.5 leading-snug font-mono text-[10px] break-all max-w-xs">
                  {msg}
                </p>
              </div>
            </div>
            <button
              onClick={this.handleRetry}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-red-300 bg-white text-red-700 hover:bg-red-50 transition-colors text-[11px] font-medium"
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          </div>
        );
      }

      // ── Full-screen fallback (app root usage) ──────────────────────────────
      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />
            <h2 className="text-xl mb-4">An unexpected error occurred.</h2>
            <div className="p-4 w-full rounded bg-muted overflow-auto mb-6">
              <pre className="text-sm text-muted-foreground whitespace-break-spaces">
                {this.state.error?.stack}
              </pre>
            </div>
            <button
              onClick={() => window.location.reload()}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 cursor-pointer"
              )}
            >
              <RotateCcw size={16} />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
