"use client";

import { useEffect, useState, useRef } from "react";
import { Plus, X, LogOut, ChevronDown, Check } from "lucide-react";
import { fetchTickers24h } from "@/lib/binance/rest";
import { getBinanceWS } from "@/lib/binance/ws";
import { useChartStore } from "@/lib/store/chart-store";
import { useIolStore } from "@/lib/store/iol-store";
import { useExplorarStore } from "@/lib/store/explorar-store";
import { useMarket } from "@/hooks/useMarket";
import { useIolQuote } from "@/hooks/useIolQuote";
import { iolAuth } from "@/lib/iol/auth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatPrice, formatPct, formatARS } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CRYPTO_NAMES, ARGENTINA_NAMES, getCryptoLogoUrl, getSymbolColor } from "@/lib/symbolInfo";

interface Row { symbol: string; price: number; pct: number; }

function SymbolAvatar({ symbol, logoUrl }: { symbol: string; logoUrl?: string }) {
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

function ArgentinaWatchlistItem({ simbolo, isActive, onSelect, onRemove }: {
  simbolo: string; isActive: boolean; onSelect: () => void; onRemove?: () => void;
}) {
  const { quote } = useIolQuote(simbolo);
  const name = ARGENTINA_NAMES[simbolo];
  return (
    <div
      onClick={onSelect}
      className={cn(
        "group grid cursor-pointer grid-cols-[auto_1fr_auto_auto] items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-tv-panel-hover",
        isActive && "bg-tv-panel-hover",
      )}
    >
      <SymbolAvatar symbol={simbolo} />
      <div className="min-w-0">
        <div className="font-medium text-tv-text">{simbolo}</div>
        {name && <div className="truncate text-[10px] text-tv-text-muted">{name}</div>}
      </div>
      <span className="text-right tabular-nums text-tv-text">{quote ? formatARS(quote.ultimoPrecio) : "—"}</span>
      <div className="flex items-center justify-end gap-1">
        <span className={cn("tabular-nums", quote ? quote.variacion >= 0 ? "text-tv-green" : "text-tv-red" : "text-tv-text-muted")}>
          {quote ? formatPct(quote.variacion) : "—"}
        </span>
        {onRemove && (
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="invisible rounded p-0.5 text-tv-text-muted hover:bg-tv-bg hover:text-tv-red group-hover:visible">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function CryptoWatchlistItem({ symbol, isActive, onSelect, onRemove }: {
  symbol: string; isActive: boolean; onSelect: () => void; onRemove?: () => void;
}) {
  const [price, setPrice] = useState<number | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const pair = symbol.endsWith("USDT") ? symbol : symbol + "USDT";
  const base = pair.replace("USDT", "");
  const name = CRYPTO_NAMES[base];

  useEffect(() => {
    fetchTickers24h([pair]).then((tickers) => {
      const t = tickers[0];
      if (t) { setPrice(t.lastPrice); setPct(t.priceChangePercent); }
    }).catch(() => {});
  }, [pair]);

  return (
    <div
      onClick={onSelect}
      className={cn(
        "group grid cursor-pointer grid-cols-[auto_1fr_auto_auto] items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-tv-panel-hover",
        isActive && "bg-tv-panel-hover",
      )}
    >
      <SymbolAvatar symbol={base} logoUrl={getCryptoLogoUrl(base)} />
      <div className="min-w-0">
        <div className="font-medium text-tv-text">{base}</div>
        {name && <div className="truncate text-[10px] text-tv-text-muted">{name}</div>}
      </div>
      <span className="text-right tabular-nums text-tv-text">{price ? formatPrice(price) : "—"}</span>
      <div className="flex items-center justify-end gap-1">
        <span className={cn("tabular-nums", pct != null ? pct >= 0 ? "text-tv-green" : "text-tv-red" : "text-tv-text-muted")}>
          {pct != null ? formatPct(pct) : "—"}
        </span>
        {onRemove && (
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="invisible rounded p-0.5 text-tv-text-muted hover:bg-tv-bg hover:text-tv-red group-hover:visible">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// Dropdown to switch between default list and custom watchlists
function ListSwitcher({ currentId, onSelect, defaultLabel }: {
  currentId: string | null; onSelect: (id: string | null) => void; defaultLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { watchlists } = useExplorarStore();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const currentName = currentId ? (watchlists.find((w) => w.id === currentId)?.name ?? defaultLabel) : defaultLabel;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-tv-text-muted hover:text-tv-text transition-colors"
      >
        {currentName}
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-44 rounded border border-tv-border bg-tv-panel shadow-lg overflow-hidden">
          <button
            onClick={() => { onSelect(null); setOpen(false); }}
            className="flex w-full items-center justify-between px-3 py-2 text-[11px] hover:bg-tv-panel-hover text-tv-text"
          >
            {defaultLabel}
            {currentId === null && <Check className="h-3 w-3 text-tv-blue" />}
          </button>
          {watchlists.length > 0 && <div className="border-t border-tv-border" />}
          {watchlists.map((w) => (
            <button
              key={w.id}
              onClick={() => { onSelect(w.id); setOpen(false); }}
              className="flex w-full items-center justify-between px-3 py-2 text-[11px] hover:bg-tv-panel-hover text-tv-text"
            >
              <span className="truncate">{w.name}</span>
              {currentId === w.id && <Check className="h-3 w-3 shrink-0 text-tv-blue" />}
            </button>
          ))}
          {watchlists.length === 0 && (
            <p className="px-3 py-2 text-[10px] text-tv-text-muted">No tenés listas creadas</p>
          )}
        </div>
      )}
    </div>
  );
}

export function Watchlist() {
  const { isArgentina } = useMarket();
  const watchlist = useChartStore((s) => s.watchlist);
  const symbol = useChartStore((s) => s.symbol);
  const setSymbol = useChartStore((s) => s.setSymbol);
  const removeFromWatchlist = useChartStore((s) => s.removeFromWatchlist);
  const openSymbolDialog = useChartStore((s) => s.setSymbolDialogOpen);

  const watchlistArgentina = useIolStore((s) => s.watchlistArgentina);
  const selectedSymbol = useIolStore((s) => s.selectedSymbol);
  const setSelectedSymbol = useIolStore((s) => s.setSelectedSymbol);
  const removeFromArgentinaWatchlist = useIolStore((s) => s.removeFromArgentinaWatchlist);
  const setLoggedIn = useIolStore((s) => s.setLoggedIn);
  const setMarket = useIolStore((s) => s.setMarket);

  const { watchlists, removeFromWatchlist: removeFromCustomList } = useExplorarStore();

  const [rows, setRows] = useState<Record<string, Row>>({});
  const [flash, setFlash] = useState<Record<string, "up" | "down" | null>>({});
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  const selectedCustomList = selectedListId ? watchlists.find((w) => w.id === selectedListId) : null;

  useEffect(() => {
    if (isArgentina || watchlist.length === 0 || selectedListId !== null) return;
    let cancelled = false;

    fetchTickers24h(watchlist).then((tickers) => {
      if (cancelled) return;
      const map: Record<string, Row> = {};
      tickers.forEach((t) => { map[t.symbol] = { symbol: t.symbol, price: t.lastPrice, pct: t.priceChangePercent }; });
      setRows(map);
    }).catch(console.error);

    const ws = getBinanceWS();
    const unsub = ws.subscribeMiniTickers(watchlist, (tick) => {
      setRows((prev) => {
        const prevRow = prev[tick.symbol];
        if (prevRow) {
          const dir = tick.close > prevRow.price ? "up" : tick.close < prevRow.price ? "down" : null;
          if (dir) {
            setFlash((f) => ({ ...f, [tick.symbol]: dir }));
            setTimeout(() => setFlash((f) => ({ ...f, [tick.symbol]: null })), 300);
          }
        }
        return { ...prev, [tick.symbol]: { symbol: tick.symbol, price: tick.close, pct: tick.pct } };
      });
    });

    return () => { cancelled = true; unsub(); };
  }, [watchlist, isArgentina, selectedListId]);

  const defaultLabel = isArgentina ? "BYMA" : "Crypto";

  // Custom list selected
  if (selectedCustomList) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-tv-border px-3 py-2">
          <ListSwitcher currentId={selectedListId} onSelect={setSelectedListId} defaultLabel={defaultLabel} />
        </div>
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-tv-border px-3 py-1.5 text-[10px] uppercase tracking-wider text-tv-text-muted">
          <span>Símbolo</span><span className="text-right">Precio</span><span className="text-right">Var%</span>
        </div>
        <ScrollArea className="flex-1">
          <div className="flex flex-col">
            {selectedCustomList.items.map((item) =>
              item.market === "argentina" ? (
                <ArgentinaWatchlistItem
                  key={item.symbol}
                  simbolo={item.symbol}
                  isActive={isArgentina && selectedSymbol === item.symbol}
                  onSelect={() => { setMarket("argentina"); setSelectedSymbol(item.symbol); }}
                  onRemove={() => removeFromCustomList(selectedListId!, item.symbol)}
                />
              ) : (
                <CryptoWatchlistItem
                  key={item.symbol}
                  symbol={item.symbol}
                  isActive={!isArgentina && symbol === item.symbol}
                  onSelect={() => { setMarket("crypto"); setSymbol(item.symbol.endsWith("USDT") ? item.symbol : item.symbol + "USDT"); }}
                  onRemove={() => removeFromCustomList(selectedListId!, item.symbol)}
                />
              )
            )}
            {selectedCustomList.items.length === 0 && (
              <p className="p-4 text-center text-xs text-tv-text-muted">Lista vacía. Agregá activos desde Explorar.</p>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Default Argentina list
  if (isArgentina) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-tv-border px-3 py-2">
          <ListSwitcher currentId={null} onSelect={setSelectedListId} defaultLabel={defaultLabel} />
          <button onClick={() => { iolAuth.clearSession(); setLoggedIn(false); }}
            className="rounded p-1 text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-red" title="Cerrar sesión IOL">
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-tv-border px-3 py-1.5 text-[10px] uppercase tracking-wider text-tv-text-muted">
          <span>Símbolo</span><span className="text-right">Precio</span><span className="text-right">Var%</span>
        </div>
        <ScrollArea className="flex-1">
          <div className="flex flex-col">
            {watchlistArgentina.map((s) => (
              <ArgentinaWatchlistItem key={s} simbolo={s} isActive={s === selectedSymbol}
                onSelect={() => setSelectedSymbol(s)} onRemove={() => removeFromArgentinaWatchlist(s)} />
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Default Crypto list
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-tv-border px-3 py-2">
        <ListSwitcher currentId={null} onSelect={setSelectedListId} defaultLabel={defaultLabel} />
        <button onClick={() => openSymbolDialog(true)}
          className="rounded p-1 text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text" title="Agregar símbolo">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-tv-border px-3 py-1.5 text-[10px] uppercase tracking-wider text-tv-text-muted">
        <span>Símbolo</span><span className="text-right">Precio</span><span className="text-right">24h</span>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {watchlist.map((s) => {
            const row = rows[s];
            const isActive = s === symbol;
            const f = flash[s];
            const base = s.replace("USDT", "");
            const name = CRYPTO_NAMES[base];
            return (
              <div key={s} onClick={() => setSymbol(s)}
                className={cn("group grid cursor-pointer grid-cols-[auto_1fr_auto_auto] items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-tv-panel-hover", isActive && "bg-tv-panel-hover")}>
                <SymbolAvatar symbol={base} logoUrl={getCryptoLogoUrl(base)} />
                <div className="min-w-0">
                  <div className="font-medium text-tv-text">{base}</div>
                  {name && <div className="truncate text-[10px] text-tv-text-muted">{name}</div>}
                </div>
                <span className={cn("text-right tabular-nums transition-colors", f === "up" && "text-tv-green", f === "down" && "text-tv-red", !f && "text-tv-text")}>
                  {row ? formatPrice(row.price) : "—"}
                </span>
                <div className="flex items-center justify-end gap-1">
                  <span className={cn("tabular-nums", row ? row.pct >= 0 ? "text-tv-green" : "text-tv-red" : "text-tv-text-muted")}>
                    {row ? formatPct(row.pct) : "—"}
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); removeFromWatchlist(s); }}
                    className="invisible rounded p-0.5 text-tv-text-muted hover:bg-tv-bg hover:text-tv-red group-hover:visible">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
          {watchlist.length === 0 && <div className="p-4 text-center text-xs text-tv-text-muted">Tu watchlist está vacío</div>}
        </div>
      </ScrollArea>
    </div>
  );
}
