"use client";

import { Zap, ChevronDown, Compass, ListChecks } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { SymbolSelector } from "@/components/chart/SymbolSelector";
import { TimeframeSelector } from "@/components/chart/TimeframeSelector";
import { IndicatorMenu } from "@/components/chart/IndicatorMenu";
import { Separator } from "@/components/ui/separator";
import { MarketSwitcher } from "@/components/layout/MarketSwitcher";
import { useMarket } from "@/hooks/useMarket";
import { useChartStore } from "@/lib/store/chart-store";
import { useIolStore } from "@/lib/store/iol-store";
import { cn } from "@/lib/utils";

export function Header() {
  const { isCrypto, isArgentina } = useMarket();
  const symbol = useChartStore((s) => s.symbol);
  const setSymbolDialogOpen = useChartStore((s) => s.setSymbolDialogOpen);
  const router = useRouter();
  const pathname = usePathname();
  const isExplorar = pathname === "/explorar";
  const isSeguimiento = pathname === "/seguimiento";
  const argSymbol = useIolStore((s) => s.selectedSymbol);

  return (
    <header className="border-b border-tv-border bg-tv-panel [padding-top:env(safe-area-inset-top)]">
      {/* Main row */}
      <div className="flex h-11 items-center gap-1 px-2 sm:px-3">
        {/* Logo — vuelve al inicio */}
        <button
          onClick={() => router.push("/")}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-tv-blue/20 transition-colors hover:bg-tv-blue/30"
          title="Inicio"
        >
          <Zap className="h-4 w-4 text-tv-blue" />
        </button>
        <span className="hidden sm:block text-sm font-semibold text-tv-text pl-1 pr-2">
          Trading<span className="text-tv-text-muted">AR</span>
        </span>

        <Separator orientation="vertical" className="h-6 bg-tv-border" />
        <MarketSwitcher />

        <Separator orientation="vertical" className="h-6 bg-tv-border" />
        <button
          onClick={() => (isExplorar ? router.push("/") : router.push("/explorar"))}
          className={cn(
            "flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors sm:px-2.5",
            isExplorar
              ? "bg-tv-blue/20 text-tv-blue"
              : "text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text",
          )}
        >
          <Compass className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Explorar</span>
        </button>

        {/* Seguimiento — solo celular */}
        <button
          onClick={() => router.push("/seguimiento")}
          className={cn(
            "flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors md:hidden",
            isSeguimiento
              ? "bg-tv-blue/20 text-tv-blue"
              : "text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text",
          )}
          title="Seguimiento"
        >
          <ListChecks className="h-3.5 w-3.5" />
        </button>

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

        {/* Mobile: tap to open symbol search (crypto) */}
        {isCrypto && (
          <button
            onClick={() => setSymbolDialogOpen(true)}
            className="md:hidden ml-1 flex min-w-0 items-center gap-1 rounded px-2 py-1 text-sm font-semibold text-tv-text hover:bg-tv-panel-hover"
          >
            <span className="truncate">{symbol.replace("USDT", "")}</span>
            <ChevronDown className="h-3 w-3 shrink-0 text-tv-text-muted" />
          </button>
        )}

        {/* Mobile: show active Argentina symbol (read-only, pick from BYMA tab) */}
        {isArgentina && (
          <div className="md:hidden ml-1 flex min-w-0 items-center gap-1 rounded px-2 py-1 text-sm font-semibold text-tv-text">
            <span className="truncate">{argSymbol}</span>
          </div>
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
