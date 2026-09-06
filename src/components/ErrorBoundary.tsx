import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Dashboard caught error in component:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl bg-red-950/40 border border-red-500/40 p-5 text-center backdrop-blur-xl shadow-2xl my-2 flex flex-col items-center justify-center">
          <div className="p-3 bg-red-500/20 text-red-400 rounded-full mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-white font-bold text-base mb-1">
            {this.props.fallbackTitle || "Component Temporarily Recovering"}
          </h3>
          <p className="text-xs text-red-200/80 max-w-md mb-3 font-mono">
            {this.state.error?.message || "An unexpected rendering event occurred. The rest of the safety system remains operational."}
          </p>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-lg"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Restore Component</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
