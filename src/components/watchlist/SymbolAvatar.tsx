"use client";

import { useState } from "react";
import { getSymbolColor } from "@/lib/symbolInfo";

export function SymbolAvatar({ symbol, logoUrl }: { symbol: string; logoUrl?: string }) {
  const [imgError, setImgError] = useState(false);
  const color = getSymbolColor(symbol);
  const initials = symbol.slice(0, 2).toUpperCase();

  if (logoUrl && !imgError) {
    return (
      <div className="relative h-6 w-6 shrink-0">
        <img
          src={logoUrl}
          alt={symbol}
          width={24}
          height={24}
          className="h-6 w-6 rounded-full object-contain"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }
  return (
    <div
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  );
}
