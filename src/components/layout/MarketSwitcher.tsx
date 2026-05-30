"use client";

import { useState } from "react";
import { useMarket } from "@/hooks/useMarket";
import { useIolStore } from "@/lib/store/iol-store";
import { IOLLoginModal } from "@/components/iol/IOLLoginModal";
import { cn } from "@/lib/utils";

export function MarketSwitcher() {
  const { market, setMarket } = useMarket();
  const isLoggedIn = useIolStore((s) => s.isLoggedIn);
  const [showLogin, setShowLogin] = useState(false);

  const handleArgentina = () => {
    setMarket("argentina");
    if (!isLoggedIn) {
      setShowLogin(true);
    }
  };

  return (
    <>
      <div className="flex items-center gap-0.5 rounded bg-tv-bg px-1 py-1">
        <button
          onClick={() => setMarket("crypto")}
          className={cn(
            "rounded px-2.5 py-1 text-xs font-medium transition-colors",
            market === "crypto"
              ? "bg-tv-blue/20 text-tv-blue"
              : "text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text",
          )}
        >
          Crypto
        </button>
        <button
          onClick={handleArgentina}
          className={cn(
            "rounded px-2.5 py-1 text-xs font-medium transition-colors",
            market === "argentina"
              ? "bg-tv-blue/20 text-tv-blue"
              : "text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text",
          )}
        >
          Argentina
        </button>
      </div>

      <IOLLoginModal
        open={showLogin}
        onClose={() => setShowLogin(false)}
        onSuccess={() => setMarket("argentina")}
      />
    </>
  );
}
