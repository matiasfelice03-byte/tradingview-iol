"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { SymbolAvatar } from "@/components/watchlist/SymbolAvatar";
import { useChartStore } from "@/lib/store/chart-store";
import { useIolStore } from "@/lib/store/iol-store";
import { useExplorarStore, type WatchlistItem } from "@/lib/store/explorar-store";
import { useIolQuote } from "@/hooks/useIolQuote";
import { fetchTickers24h } from "@/lib/binance/rest";
import { formatPrice, formatPct, formatARS } from "@/lib/format";
import { CRYPTO_NAMES, ARGENTINA_NAMES, getCryptoLogoUrl } from "@/lib/symbolInfo";
import { cn } from "@/lib/utils";

interface TrackList {
  id: string;
  name: string;
  items: WatchlistItem[];
}

function ArgentinaRow({ symbol, onOpen }: { symbol: string; onOpen: () => void }) {
  const { quote } = useIolQuote(symbol);
  const name = ARGENTINA_NAMES[symbol];
  const pct = quote?.variacion ?? null;
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-3 border-b border-tv-border px-4 py-3 text-left transition-colors hover:bg-tv-panel-hover active:bg-tv-panel-hover"
    >
      <SymbolAvatar symbol={symbol} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-tv-text">{symbol}</div>
        {name && <div className="truncate text-xs text-tv-text-muted">{name}</div>}
      </div>
      <div className="text-right">
        <div className="text-sm tabular-nums text-tv-text">
          {quote ? formatARS(quote.ultimoPrecio) : "—"}
        </div>
        <div
          className={cn(
            "text-xs tabular-nums",
            pct == null ? "text-tv-text-muted" : pct >= 0 ? "text-tv-green" : "text-tv-red",
          )}
        >
          {pct != null ? formatPct(pct) : "—"}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-tv-text-muted" />
    </button>
  );
}

function CryptoRow({ symbol, onOpen }: { symbol: string; onOpen: () => void }) {
  const pair = symbol.endsWith("USDT") ? symbol : symbol + "USDT";
  const base = pair.replace("USDT", "");
  const name = CRYPTO_NAMES[base];
  const [price, setPrice] = useState<number | null>(null);
  const [pct, setPct] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchTickers24h([pair])
        .then((t) => {
          if (cancelled || !t[0]) return;
          setPrice(t[0].lastPrice);
          setPct(t[0].priceChangePercent);
        })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [pair]);

  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-3 border-b border-tv-border px-4 py-3 text-left transition-colors hover:bg-tv-panel-hover active:bg-tv-panel-hover"
    >
      <SymbolAvatar symbol={base} logoUrl={getCryptoLogoUrl(base)} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-tv-text">{base}</div>
        {name && <div className="truncate text-xs text-tv-text-muted">{name}</div>}
      </div>
      <div className="text-right">
        <div className="text-sm tabular-nums text-tv-text">
          {price != null ? formatPrice(price) : "—"}
        </div>
        <div
          className={cn(
            "text-xs tabular-nums",
            pct == null ? "text-tv-text-muted" : pct >= 0 ? "text-tv-green" : "text-tv-red",
          )}
        >
          {pct != null ? formatPct(pct) : "—"}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-tv-text-muted" />
    </button>
  );
}

export default function SeguimientoPage() {
  const router = useRouter();
  const watchlistArgentina = useIolStore((s) => s.watchlistArgentina);
  const setMarket = useIolStore((s) => s.setMarket);
  const setSelectedSymbol = useIolStore((s) => s.setSelectedSymbol);
  const cryptoWatchlist = useChartStore((s) => s.watchlist);
  const setSymbol = useChartStore((s) => s.setSymbol);
  const customLists = useExplorarStore((s) => s.watchlists);

  const lists: TrackList[] = [
    {
      id: "__byma",
      name: "BYMA",
      items: watchlistArgentina.map((s) => ({ symbol: s, market: "argentina" as const })),
    },
    {
      id: "__crypto",
      name: "Crypto",
      items: cryptoWatchlist.map((s) => ({ symbol: s, market: "crypto" as const })),
    },
    ...customLists,
  ];

  const [selectedId, setSelectedId] = useState<string>("__byma");
  const selected = lists.find((l) => l.id === selectedId) ?? lists[0];

  const openAsset = (item: WatchlistItem) => {
    if (item.market === "argentina") {
      setMarket("argentina");
      setSelectedSymbol(item.symbol);
    } else {
      setMarket("crypto");
      setSymbol(item.symbol.endsWith("USDT") ? item.symbol : item.symbol + "USDT");
    }
    router.push("/");
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-tv-bg">
      <Header />

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-hidden">
        {/* List selector */}
        <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-tv-border bg-tv-panel px-3 py-2 scrollbar-none">
          {lists.map((l) => (
            <button
              key={l.id}
              onClick={() => setSelectedId(l.id)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                selected?.id === l.id
                  ? "bg-tv-blue text-white"
                  : "bg-tv-bg text-tv-text-muted hover:text-tv-text",
              )}
            >
              {l.name}
              <span className="ml-1.5 text-[10px] opacity-70">{l.items.length}</span>
            </button>
          ))}
        </div>

        {/* Asset list */}
        <div className="flex-1 overflow-y-auto">
          {!selected || selected.items.length === 0 ? (
            <p className="p-8 text-center text-sm text-tv-text-muted">
              {selected
                ? "Esta lista está vacía. Agregá activos desde el panel lateral o Explorar."
                : "No hay listas."}
            </p>
          ) : (
            selected.items.map((item) =>
              item.market === "argentina" ? (
                <ArgentinaRow
                  key={`a-${item.symbol}`}
                  symbol={item.symbol}
                  onOpen={() => openAsset(item)}
                />
              ) : (
                <CryptoRow
                  key={`c-${item.symbol}`}
                  symbol={item.symbol}
                  onOpen={() => openAsset(item)}
                />
              ),
            )
          )}
        </div>
      </div>
    </div>
  );
}
