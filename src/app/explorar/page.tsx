"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import {
  useExplorarStore,
  type Watchlist,
  type WatchlistItem,
  type PriceAlert,
} from "@/lib/store/explorar-store";
import { fetchIolQuote } from "@/lib/iol/rest";
import { cn } from "@/lib/utils";
import {
  Plus,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronUp,
  Bell,
  BellOff,
  X,
} from "lucide-react";

const CRYPTO_PAIRS = [
  "BTC", "ETH", "BNB", "SOL", "ADA", "XRP", "DOGE", "AVAX", "DOT",
  "MATIC", "LINK", "UNI", "ATOM", "LTC", "BCH", "ALGO", "XLM", "VET",
  "FIL", "SAND",
];

type Tab = "buscar" | "listas" | "alertas";

// ─── Search Tab ───────────────────────────────────────────────────────────────

interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  market: "argentina" | "crypto";
}

function SearchTab() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [dropdownFor, setDropdownFor] = useState<string | null>(null);
  const { watchlists, addToWatchlist } = useExplorarStore();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const q = query.toUpperCase();
        const cryptoMatches: SearchResult[] = CRYPTO_PAIRS.filter((p) =>
          p.startsWith(q),
        ).map((p) => ({
          symbol: p + "USDT",
          name: p,
          exchange: "Binance",
          market: "crypto" as const,
        }));

        const res = await fetch(
          `/api/yahoo/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&enableFuzzyQuery=false`,
        );
        const yahooResults: SearchResult[] = [];
        if (res.ok) {
          const data = await res.json();
          const quotes = data?.quotes ?? [];
          for (const q of quotes) {
            if (q.symbol) {
              yahooResults.push({
                symbol: q.symbol,
                name: q.shortname || q.longname || q.symbol,
                exchange: q.exchange || "",
                market: "argentina",
              });
            }
          }
        }

        setResults([...cryptoMatches, ...yahooResults].slice(0, 15));
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }, 350);
  }, [query]);

  const handleAdd = (result: SearchResult, listId: string) => {
    addToWatchlist(listId, { symbol: result.symbol, market: result.market });
    setDropdownFor(null);
  };

  return (
    <div className="flex flex-col gap-4 p-4 max-w-2xl">
      <input
        type="text"
        placeholder="Buscar símbolo, empresa..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="bg-tv-bg border border-tv-border rounded px-3 py-2 text-sm text-tv-text focus:border-tv-blue focus:outline-none"
      />

      {loading && (
        <p className="text-tv-text-muted text-xs">Buscando...</p>
      )}

      {results.length > 0 && (
        <div className="flex flex-col gap-1">
          {results.map((r) => (
            <div
              key={r.symbol}
              className="flex items-center justify-between bg-tv-panel border border-tv-border rounded-lg px-3 py-2"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium text-tv-text">
                  {r.symbol}
                </span>
                <span className="text-tv-text-muted text-xs">
                  {r.name} · {r.exchange || r.market}
                </span>
              </div>

              <div className="relative">
                <button
                  onClick={() =>
                    setDropdownFor(dropdownFor === r.symbol ? null : r.symbol)
                  }
                  disabled={watchlists.length === 0}
                  className="bg-tv-blue text-white rounded px-3 py-1.5 text-sm hover:bg-tv-blue/80 disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>

                {dropdownFor === r.symbol && watchlists.length > 0 && (
                  <div className="absolute right-0 top-8 z-50 bg-tv-panel border border-tv-border rounded-lg shadow-lg min-w-[140px]">
                    {watchlists.map((w) => (
                      <button
                        key={w.id}
                        onClick={() => handleAdd(r, w.id)}
                        className="w-full text-left px-3 py-2 text-sm text-tv-text hover:bg-tv-panel-hover"
                      >
                        {w.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {watchlists.length === 0 && (
        <p className="text-tv-text-muted text-xs">
          Crea una lista primero en "Mis Listas" para poder agregar símbolos.
        </p>
      )}
    </div>
  );
}

// ─── Watchlist Item Row ───────────────────────────────────────────────────────

function WatchlistItemRow({
  item,
  listId,
  annotation,
  onRemove,
  onAnnotate,
}: {
  item: WatchlistItem;
  listId: string;
  annotation: string;
  onRemove: () => void;
  onAnnotate: (text: string) => void;
}) {
  const [price, setPrice] = useState<number | null>(null);
  const [change, setChange] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(annotation);

  const fetchPrice = useCallback(async () => {
    try {
      if (item.market === "crypto") {
        const res = await fetch(
          `https://api.binance.com/api/v3/ticker/24hr?symbol=${item.symbol}`,
        );
        if (res.ok) {
          const d = await res.json();
          setPrice(parseFloat(d.lastPrice));
          setChange(parseFloat(d.priceChangePercent));
        }
      } else {
        const q = await fetchIolQuote(item.symbol);
        setPrice(q.ultimoPrecio ?? null);
        const pct = q.ultimoPrecio && q.variacion != null ? q.variacion : null;
        setChange(pct);
      }
    } catch {
      // ignore
    }
  }, [item]);

  useEffect(() => {
    fetchPrice();
    const iv = setInterval(fetchPrice, 30_000);
    return () => clearInterval(iv);
  }, [fetchPrice]);

  return (
    <div className="bg-tv-panel border border-tv-border rounded-lg">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium text-tv-text truncate">
            {item.symbol}
          </span>
          <span className="text-tv-text-muted text-xs">{item.market}</span>
        </div>

        <div className="flex items-center gap-3">
          {price !== null && (
            <div className="text-right">
              <div className="text-sm text-tv-text">
                {price.toLocaleString("es-AR", { maximumFractionDigits: 4 })}
              </div>
              {change !== null && (
                <div
                  className={cn(
                    "text-xs",
                    change >= 0 ? "text-tv-green" : "text-tv-red",
                  )}
                >
                  {change >= 0 ? "+" : ""}
                  {change.toFixed(2)}%
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setOpen((v) => !v)}
            className="text-tv-text-muted hover:text-tv-text"
          >
            {open ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          <button
            onClick={onRemove}
            className="text-tv-text-muted hover:text-tv-red"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-tv-border px-3 py-2">
          <textarea
            rows={2}
            placeholder="Anotación..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => onAnnotate(note)}
            className="w-full bg-tv-bg border border-tv-border rounded px-2 py-1.5 text-xs text-tv-text focus:border-tv-blue focus:outline-none resize-none"
          />
        </div>
      )}
    </div>
  );
}

// ─── Lists Tab ────────────────────────────────────────────────────────────────

function ListsTab() {
  const { watchlists, addWatchlist, removeWatchlist, renameWatchlist, removeFromWatchlist, annotations, setAnnotation } =
    useExplorarStore();
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");

  const selectedList = watchlists.find((w) => w.id === selected) ?? null;

  const handleCreate = () => {
    if (!newName.trim()) return;
    addWatchlist(newName.trim());
    setNewName("");
    setCreating(false);
  };

  const handleRename = (id: string) => {
    if (!renameVal.trim()) return;
    renameWatchlist(id, renameVal.trim());
    setRenaming(null);
  };

  return (
    <div className="flex flex-1 min-h-0 gap-4 p-4">
      {/* Sidebar */}
      <div className="flex flex-col gap-2 w-48 shrink-0">
        <button
          onClick={() => setCreating(true)}
          className="bg-tv-blue text-white rounded px-3 py-1.5 text-sm hover:bg-tv-blue/80 text-left"
        >
          + Nueva lista
        </button>

        {creating && (
          <div className="flex gap-1">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") setCreating(false);
              }}
              placeholder="Nombre..."
              className="flex-1 bg-tv-bg border border-tv-border rounded px-2 py-1 text-xs text-tv-text focus:border-tv-blue focus:outline-none"
            />
            <button
              onClick={handleCreate}
              className="bg-tv-blue text-white rounded px-2 py-1 text-xs hover:bg-tv-blue/80"
            >
              OK
            </button>
          </div>
        )}

        {watchlists.map((w) => (
          <div
            key={w.id}
            className={cn(
              "group flex items-center justify-between rounded-lg px-2 py-2 cursor-pointer",
              selected === w.id
                ? "bg-tv-blue/20 border border-tv-blue/40"
                : "bg-tv-panel border border-tv-border hover:bg-tv-panel-hover",
            )}
            onClick={() => setSelected(w.id)}
          >
            {renaming === w.id ? (
              <input
                autoFocus
                value={renameVal}
                onChange={(e) => setRenameVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename(w.id);
                  if (e.key === "Escape") setRenaming(null);
                }}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 bg-tv-bg border border-tv-border rounded px-1 py-0.5 text-xs text-tv-text focus:outline-none"
              />
            ) : (
              <span className="text-sm text-tv-text truncate flex-1">
                {w.name}
              </span>
            )}

            <div className="flex gap-1 opacity-0 group-hover:opacity-100 shrink-0 ml-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setRenaming(w.id);
                  setRenameVal(w.name);
                }}
                className="text-tv-text-muted hover:text-tv-text"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (selected === w.id) setSelected(null);
                  removeWatchlist(w.id);
                }}
                className="text-tv-text-muted hover:text-tv-red"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Items */}
      <div className="flex-1 min-w-0">
        {!selectedList && (
          <p className="text-tv-text-muted text-sm">
            Seleccioná una lista para ver sus items.
          </p>
        )}

        {selectedList && (
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-tv-text">
              {selectedList.name}
            </h2>

            {selectedList.items.length === 0 && (
              <p className="text-tv-text-muted text-xs">
                Esta lista está vacía. Agregá símbolos desde "Buscar".
              </p>
            )}

            {selectedList.items.map((item) => {
              const ann =
                annotations.find((a) => a.symbol === item.symbol)?.text ?? "";
              return (
                <WatchlistItemRow
                  key={item.symbol}
                  item={item}
                  listId={selectedList.id}
                  annotation={ann}
                  onRemove={() =>
                    removeFromWatchlist(selectedList.id, item.symbol)
                  }
                  onAnnotate={(text) => setAnnotation(item.symbol, text)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Alerts Tab ───────────────────────────────────────────────────────────────

const EMPTY_ALERT: Omit<PriceAlert, "id" | "triggered" | "createdAt"> = {
  symbol: "",
  market: "argentina",
  direction: "above",
  targetPrice: 0,
  message: "",
  active: true,
};

function AlertsTab() {
  const { alerts, addAlert, removeAlert, toggleAlert } = useExplorarStore();
  const [form, setForm] = useState({ ...EMPTY_ALERT });
  const [withAction, setWithAction] = useState(false);
  const [action, setAction] = useState<NonNullable<PriceAlert["action"]>>({
    type: "buy",
    quantity: 1,
    orderType: "precioMercado",
    plazo: "T2",
  });
  const notifAsked = useRef(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.symbol.trim() || form.targetPrice <= 0) return;

    if (!notifAsked.current && "Notification" in window) {
      notifAsked.current = true;
      Notification.requestPermission();
    }

    addAlert({
      ...form,
      symbol: form.symbol.trim().toUpperCase(),
      action: withAction ? action : undefined,
    });
    setForm({ ...EMPTY_ALERT });
    setWithAction(false);
  };

  return (
    <div className="flex flex-col gap-6 p-4 max-w-2xl">
      {/* Form */}
      <div className="bg-tv-panel border border-tv-border rounded-lg p-4">
        <h2 className="text-sm font-semibold text-tv-text mb-3">
          Nueva alerta
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-tv-text-muted text-xs">Símbolo</label>
              <input
                value={form.symbol}
                onChange={(e) =>
                  setForm((f) => ({ ...f, symbol: e.target.value }))
                }
                placeholder="GGAL, BTCUSDT..."
                className="bg-tv-bg border border-tv-border rounded px-3 py-2 text-sm text-tv-text focus:border-tv-blue focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-tv-text-muted text-xs">Mercado</label>
              <select
                value={form.market}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    market: e.target.value as "argentina" | "crypto",
                  }))
                }
                className="bg-tv-bg border border-tv-border rounded px-3 py-2 text-sm text-tv-text focus:border-tv-blue focus:outline-none"
              >
                <option value="argentina">Argentina</option>
                <option value="crypto">Crypto</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-tv-text-muted text-xs">Dirección</label>
              <select
                value={form.direction}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    direction: e.target.value as "above" | "below",
                  }))
                }
                className="bg-tv-bg border border-tv-border rounded px-3 py-2 text-sm text-tv-text focus:border-tv-blue focus:outline-none"
              >
                <option value="above">Por encima</option>
                <option value="below">Por debajo</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-tv-text-muted text-xs">
                Precio objetivo
              </label>
              <input
                type="number"
                step="any"
                value={form.targetPrice || ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    targetPrice: parseFloat(e.target.value) || 0,
                  }))
                }
                className="bg-tv-bg border border-tv-border rounded px-3 py-2 text-sm text-tv-text focus:border-tv-blue focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-tv-text-muted text-xs">
              Mensaje (opcional)
            </label>
            <input
              value={form.message}
              onChange={(e) =>
                setForm((f) => ({ ...f, message: e.target.value }))
              }
              placeholder="¡GGAL rompió resistencia!"
              className="bg-tv-bg border border-tv-border rounded px-3 py-2 text-sm text-tv-text focus:border-tv-blue focus:outline-none"
            />
          </div>

          {/* Action toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              onClick={() => setWithAction((v) => !v)}
              className={cn(
                "relative w-8 h-4 rounded-full transition-colors",
                withAction ? "bg-tv-blue" : "bg-tv-border",
              )}
            >
              <div
                className={cn(
                  "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform",
                  withAction ? "translate-x-4" : "translate-x-0.5",
                )}
              />
            </div>
            <span className="text-xs text-tv-text-muted">
              Conectar a orden (solo Argentina)
            </span>
          </label>

          {withAction && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-tv-bg rounded-lg border border-tv-border">
              <div className="flex flex-col gap-1">
                <label className="text-tv-text-muted text-xs">Tipo</label>
                <select
                  value={action.type}
                  onChange={(e) =>
                    setAction((a) => ({
                      ...a,
                      type: e.target.value as "buy" | "sell",
                    }))
                  }
                  className="bg-tv-bg border border-tv-border rounded px-3 py-2 text-sm text-tv-text focus:border-tv-blue focus:outline-none"
                >
                  <option value="buy">Comprar</option>
                  <option value="sell">Vender</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-tv-text-muted text-xs">Cantidad</label>
                <input
                  type="number"
                  min={1}
                  value={action.quantity}
                  onChange={(e) =>
                    setAction((a) => ({
                      ...a,
                      quantity: parseInt(e.target.value) || 1,
                    }))
                  }
                  className="bg-tv-bg border border-tv-border rounded px-3 py-2 text-sm text-tv-text focus:border-tv-blue focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-tv-text-muted text-xs">
                  Tipo orden
                </label>
                <select
                  value={action.orderType}
                  onChange={(e) =>
                    setAction((a) => ({
                      ...a,
                      orderType: e.target.value as
                        | "precioLimite"
                        | "precioMercado",
                    }))
                  }
                  className="bg-tv-bg border border-tv-border rounded px-3 py-2 text-sm text-tv-text focus:border-tv-blue focus:outline-none"
                >
                  <option value="precioMercado">Precio Mercado</option>
                  <option value="precioLimite">Precio Límite</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-tv-text-muted text-xs">Plazo</label>
                <select
                  value={action.plazo}
                  onChange={(e) =>
                    setAction((a) => ({
                      ...a,
                      plazo: e.target.value as "T0" | "T1" | "T2",
                    }))
                  }
                  className="bg-tv-bg border border-tv-border rounded px-3 py-2 text-sm text-tv-text focus:border-tv-blue focus:outline-none"
                >
                  <option value="T0">T+0</option>
                  <option value="T1">T+1</option>
                  <option value="T2">T+2</option>
                </select>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="bg-tv-blue text-white rounded px-3 py-1.5 text-sm hover:bg-tv-blue/80 self-start"
          >
            Crear alerta
          </button>
        </form>
      </div>

      {/* Alert list */}
      {alerts.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-tv-text">Alertas</h2>
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between bg-tv-panel border border-tv-border rounded-lg px-3 py-2"
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-tv-text">
                    {alert.symbol}
                  </span>
                  <span
                    className={cn(
                      "text-xs px-1.5 py-0.5 rounded",
                      alert.triggered
                        ? "bg-tv-red/20 text-tv-red"
                        : alert.active
                        ? "bg-tv-green/20 text-tv-green"
                        : "bg-tv-border text-tv-text-muted",
                    )}
                  >
                    {alert.triggered
                      ? "Disparada"
                      : alert.active
                      ? "Activa"
                      : "Pausada"}
                  </span>
                </div>
                <span className="text-tv-text-muted text-xs">
                  {alert.direction === "above" ? "Por encima de" : "Por debajo de"}{" "}
                  {alert.targetPrice.toLocaleString("es-AR")}
                  {alert.message && ` · ${alert.message}`}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {!alert.triggered && (
                  <button
                    onClick={() => toggleAlert(alert.id)}
                    className="text-tv-text-muted hover:text-tv-text"
                    title={alert.active ? "Pausar" : "Activar"}
                  >
                    {alert.active ? (
                      <Bell className="h-4 w-4" />
                    ) : (
                      <BellOff className="h-4 w-4" />
                    )}
                  </button>
                )}
                <button
                  onClick={() => removeAlert(alert.id)}
                  className="text-tv-text-muted hover:text-tv-red"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExplorarPage() {
  const [tab, setTab] = useState<Tab>("buscar");

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-tv-bg">
      <Header />

      <div className="flex flex-col flex-1 min-h-0">
        {/* Tabs */}
        <div className="flex gap-0 border-b border-tv-border bg-tv-panel px-4">
          {(["buscar", "listas", "alertas"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px",
                tab === t
                  ? "border-tv-blue text-tv-blue"
                  : "border-transparent text-tv-text-muted hover:text-tv-text",
              )}
            >
              {t === "buscar"
                ? "Buscar"
                : t === "listas"
                ? "Mis Listas"
                : "Alertas"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {tab === "buscar" && <SearchTab />}
          {tab === "listas" && <ListsTab />}
          {tab === "alertas" && <AlertsTab />}
        </div>
      </div>
    </div>
  );
}
