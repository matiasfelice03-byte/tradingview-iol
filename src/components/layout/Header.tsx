"use client";

import { Zap, ChevronDown } from "lucide-react";
import { SymbolSelector } from "@/components/chart/SymbolSelector";
import { TimeframeSelector } from "@/components/chart/TimeframeSelector";
import { IndicatorMenu } from "@/components/chart/IndicatorMenu";
import { Separator } from "@/components/ui/separator";
import { MarketSwitcher } from "@/components/layout/MarketSwitcher";
import { useMarket } from "@/hooks/useMarket";
import { useChartStore } from "@/lib/store/chart-store";

export function Header() {
  const { isCrypto } = useMarket();
  const symbol = useChartStore((s) => s.symbol);
  const setSymbolDialogOpen = useChartStore((s) => s.setSymbolDialogOpen);

  return (
    <header className="border-b border-tv-border bg-tv-panel">
      {/* Main row */}
      <div className="flex h-11 items-center gap-1 px-3">
        {/* Logo */}
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-tv-blue/20">
          <Zap className="h-4 w-4 text-tv-blue" />
        </div>
        <span className="hidden sm:block text-sm font-semibold text-tv-text pl-1 pr-2">
          Trading<span className="text-tv-text-muted">AR</span>
        </span>

        <Separator orientation="vertical" className="h-6 bg-tv-border" />
        <MarketSwitcher />

        {/* Desktop: full chart controls */}
        {isCrypto && (
          <div className="hidden md:flex items-center gap-1">
            <Separator orientation="vertical" className="h-6 bg-tv-border" />
            <SymbolSelector />
            <Separator orientation="vertical" className="h-6 bg-tv-border" />
            <TimeframeSelector />
            <Separator orientation="vertical" className="mx-1 h-6 bg-tv-border" />
            <IndicatorMenu />
          </div>
        )}
        {!isCrypto && (
          <div className="hidden md:flex items-center gap-1">
            <Separator orientation="vertical" className="h-6 bg-tv-border" />
            <IndicatorMenu />
          </div>
        )}

        {/* Mobile: tap to open symbol search */}
        {isCrypto && (
          <button
            onClick={() => setSymbolDialogOpen(true)}
            className="md:hidden ml-1 flex items-center gap-1 rounded px-2 py-1 text-sm font-semibold text-tv-text hover:bg-tv-panel-hover"
          >
            {symbol.replace("USDT", "")}
            <ChevronDown className="h-3 w-3 text-tv-text-muted" />
          </button>
        )}
      </div>

      {/* Mobile toolbar row: timeframe + indicators (crypto only) */}
      {isCrypto && (
        <div className="md:hidden flex items-center gap-2 overflow-x-auto border-t border-tv-border px-3 py-1.5 scrollbar-none">
          <TimeframeSelector />
          <div className="shrink-0">
            <IndicatorMenu />
          </div>
        </div>
      )}
    </header>
  );
}
