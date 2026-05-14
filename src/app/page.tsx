"use client";

import { useState } from "react";
import { BarChart2, List, ArrowUpDown } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { IolLeftSidebar } from "@/components/layout/IolLeftSidebar";
import { BottomPanel } from "@/components/layout/BottomPanel";
import { PriceChart } from "@/components/chart/PriceChart";
import { IolPriceChart } from "@/components/chart/IolPriceChart";
import { OrderPanel } from "@/components/iol/OrderPanel";
import { Watchlist } from "@/components/watchlist/Watchlist";
import { IndicatorSettingsDialog } from "@/components/chart/IndicatorSettingsDialog";
import { useChartStore } from "@/lib/store/chart-store";
import { useMarket } from "@/hooks/useMarket";
import { cn } from "@/lib/utils";

type MobileTab = "chart" | "watchlist" | "operar";

export default function HomePage() {
  const symbol = useChartStore((s) => s.symbol);
  const timeframe = useChartStore((s) => s.timeframe);
  const { isCrypto, isArgentina } = useMarket();
  const [mobileTab, setMobileTab] = useState<MobileTab>("chart");

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-tv-bg">
      <Header />

      {/* Content area — single unified layout, no chart duplication */}
      <div className="relative flex min-h-0 flex-1">
        {/* Left sidebar: desktop only */}
        {isCrypto && <div className="hidden md:block"><LeftSidebar /></div>}
        {isArgentina && <div className="hidden md:block"><IolLeftSidebar /></div>}

        {/* Main — chart renders ONCE here */}
        <main className="relative flex min-h-0 flex-1 flex-col">
          {/* Chart: hidden on mobile when watchlist tab active */}
          <div className={cn(
            "min-h-0 flex-1",
            mobileTab === "watchlist" && "hidden md:flex",
          )}>
            {isCrypto && <PriceChart symbol={symbol} timeframe={timeframe} />}
            {isArgentina && <IolPriceChart />}
          </div>

          {/* Order panel: desktop always / mobile only on operar tab */}
          {isArgentina && (
            <div className={cn("hidden md:block", mobileTab === "operar" && "block")}>
              <OrderPanel />
            </div>
          )}
        </main>

        {/* Watchlist: desktop fixed sidebar */}
        <aside className="hidden md:flex w-64 flex-col border-l border-tv-border bg-tv-panel">
          <Watchlist />
        </aside>

        {/* Watchlist: mobile overlay — only mounted when tab is active (avoids 18 idle polls) */}
        {mobileTab === "watchlist" && (
          <div className="md:hidden absolute inset-0 z-20 flex flex-col bg-tv-panel">
            <Watchlist />
          </div>
        )}
      </div>

      {/* Desktop bottom panel */}
      {isCrypto && <div className="hidden md:block"><BottomPanel /></div>}

      {/* Mobile bottom nav */}
      <nav className="md:hidden flex h-14 shrink-0 items-stretch border-t border-tv-border bg-tv-panel">
        <MobileNavBtn
          icon={BarChart2}
          label="Chart"
          active={mobileTab === "chart"}
          onClick={() => setMobileTab("chart")}
        />
        <MobileNavBtn
          icon={List}
          label={isArgentina ? "BYMA" : "Watchlist"}
          active={mobileTab === "watchlist"}
          onClick={() => setMobileTab("watchlist")}
        />
        {isArgentina && (
          <MobileNavBtn
            icon={ArrowUpDown}
            label="Operar"
            active={mobileTab === "operar"}
            onClick={() => setMobileTab("operar")}
          />
        )}
      </nav>

      <IndicatorSettingsDialog />
    </div>
  );
}

function MobileNavBtn({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
        active ? "text-tv-blue" : "text-tv-text-muted hover:text-tv-text",
      )}
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
    </button>
  );
}
