"use client";

import { Component, type ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export class ChartErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full w-full items-center justify-center bg-tv-bg">
          <div className="rounded bg-tv-panel px-4 py-3 text-center">
            <p className="text-xs text-tv-red mb-1">Error en el gráfico</p>
            <p className="text-[11px] text-tv-text-muted max-w-xs">{this.state.error.message}</p>
            <button
              className="mt-2 rounded bg-tv-blue/20 px-3 py-1 text-[11px] text-tv-blue hover:bg-tv-blue/30"
              onClick={() => this.setState({ error: null })}
            >
              Reintentar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
