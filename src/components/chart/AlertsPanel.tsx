"use client";

import { useState, useRef, useEffect } from "react";
import { BellPlus, X, Bell, BellOff, Trash2, ChevronDown } from "lucide-react";
import { useExplorarStore, type PriceAlert } from "@/lib/store/explorar-store";
import { cn } from "@/lib/utils";

interface Props {
  symbol: string;
  market: "argentina" | "crypto";
  currentPrice: number;
}

type Dir = "above" | "below";

export function AlertsPanel({ symbol, market, currentPrice }: Props) {
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const { alerts, addAlert, removeAlert, toggleAlert } = useExplorarStore();

  const [dir, setDir] = useState<Dir>("above");
  const [price, setPrice] = useState(currentPrice.toString());
  const [message, setMessage] = useState("");
  const [withOrder, setWithOrder] = useState(false);
  const [orderType, setOrderType] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState("1");
  const [plazo, setPlazo] = useState<"T0" | "T1" | "T2">("T2");

  const symbolAlerts = alerts.filter((a) => a.symbol === symbol);

  useEffect(() => {
    setPrice(currentPrice > 0 ? currentPrice.toString() : "");
  }, [symbol, currentPrice]);

  function handleCreate() {
    const p = parseFloat(price);
    if (!p || p <= 0) return;
    if (Notification.permission === "default") Notification.requestPermission();
    addAlert({
      symbol, market, direction: dir, targetPrice: p,
      message: message || `${symbol} ${dir === "above" ? "superó" : "bajó de"} ${p}`,
      active: true,
      ...(withOrder && market === "argentina" ? {
        action: { type: orderType, quantity: parseInt(quantity) || 1, orderType: "precioLimite", plazo }
      } : {}),
    });
    setShowForm(false);
    setMessage("");
    setWithOrder(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "pointer-events-auto absolute bottom-24 right-3 z-30 flex h-9 items-center gap-1.5 rounded-full px-3 shadow-lg transition-all",
          open ? "bg-amber-500/20 border border-amber-500 text-amber-400"
               : "bg-tv-panel border border-tv-border text-tv-text-muted hover:border-amber-500 hover:text-amber-400",
          symbolAlerts.some((a) => a.active && !a.triggered) && !open && "border-amber-500/50 text-amber-500",
        )}
        title="Alertas de precio"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
        <span className="text-[11px] font-semibold">Alertas</span>
        {symbolAlerts.filter((a) => a.active && !a.triggered).length > 0 && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-black">
            {symbolAlerts.filter((a) => a.active && !a.triggered).length}
          </span>
        )}
      </button>

      {open && (
        <div className="pointer-events-auto absolute bottom-0 right-0 z-40 flex w-72 flex-col rounded-tl-xl border-l border-t border-tv-border bg-tv-panel shadow-2xl sm:w-80"
          style={{ maxHeight: 480 }}>
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-tv-border px-3 py-2">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-amber-400" />
              <span className="text-[12px] font-semibold text-tv-text">Alertas · {symbol}</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setShowForm((v) => !v)}
                className={cn("flex items-center gap-1 rounded px-2 py-0.5 text-[10px] transition-colors",
                  showForm ? "bg-amber-500/20 text-amber-400" : "text-tv-text-muted hover:text-tv-text")}>
                <BellPlus className="h-3 w-3" />
                Nueva
              </button>
              <button onClick={() => setOpen(false)} className="rounded p-1 text-tv-text-muted hover:text-tv-red">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Form */}
          {showForm && (
            <div className="shrink-0 border-b border-tv-border p-3 space-y-2">
              <div className="flex gap-2">
                <button onClick={() => setDir("above")}
                  className={cn("flex-1 rounded py-1.5 text-[11px] font-medium transition-colors",
                    dir === "above" ? "bg-tv-green/20 text-tv-green border border-tv-green/40" : "bg-tv-bg text-tv-text-muted border border-tv-border hover:border-tv-text-muted")}>
                  Por encima ↑
                </button>
                <button onClick={() => setDir("below")}
                  className={cn("flex-1 rounded py-1.5 text-[11px] font-medium transition-colors",
                    dir === "below" ? "bg-tv-red/20 text-tv-red border border-tv-red/40" : "bg-tv-bg text-tv-text-muted border border-tv-border hover:border-tv-text-muted")}>
                  Por debajo ↓
                </button>
              </div>
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Precio objetivo"
                className="w-full rounded bg-tv-bg border border-tv-border px-2.5 py-1.5 text-[11px] text-tv-text focus:border-tv-blue focus:outline-none" />
              <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Mensaje (opcional)"
                className="w-full rounded bg-tv-bg border border-tv-border px-2.5 py-1.5 text-[11px] text-tv-text focus:border-tv-blue focus:outline-none" />
              {market === "argentina" && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={withOrder} onChange={(e) => setWithOrder(e.target.checked)}
                    className="accent-amber-500" />
                  <span className="text-[11px] text-tv-text-muted">Conectar a orden IOL</span>
                </label>
              )}
              {withOrder && market === "argentina" && (
                <div className="space-y-1.5 rounded border border-tv-border p-2">
                  <div className="flex gap-2">
                    {(["buy", "sell"] as const).map((t) => (
                      <button key={t} onClick={() => setOrderType(t)}
                        className={cn("flex-1 rounded py-1 text-[10px] font-medium",
                          orderType === t ? t === "buy" ? "bg-tv-green/20 text-tv-green" : "bg-tv-red/20 text-tv-red"
                            : "bg-tv-bg text-tv-text-muted border border-tv-border")}>
                        {t === "buy" ? "Comprar" : "Vender"}
                      </button>
                    ))}
                  </div>
                  <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Cantidad"
                    className="w-full rounded bg-tv-bg border border-tv-border px-2.5 py-1 text-[11px] text-tv-text focus:border-tv-blue focus:outline-none" />
                  <select value={plazo} onChange={(e) => setPlazo(e.target.value as "T0" | "T1" | "T2")}
                    className="w-full rounded bg-tv-bg border border-tv-border px-2.5 py-1 text-[11px] text-tv-text focus:border-tv-blue focus:outline-none">
                    <option value="T0">T+0</option><option value="T1">T+1</option><option value="T2">T+2</option>
                  </select>
                </div>
              )}
              <button onClick={handleCreate}
                className="w-full rounded bg-amber-500 py-1.5 text-[11px] font-semibold text-black hover:bg-amber-400 transition-colors">
                Crear alerta
              </button>
            </div>
          )}

          {/* Alert list */}
          <div className="flex-1 overflow-y-auto">
            {symbolAlerts.length === 0 ? (
              <p className="p-4 text-center text-[11px] text-tv-text-muted">
                No hay alertas para {symbol}.<br />Creá una con el botón &quot;Nueva&quot;.
              </p>
            ) : (
              <div className="divide-y divide-tv-border">
                {symbolAlerts.map((a) => (
                  <AlertRow key={a.id} alert={a} onToggle={() => toggleAlert(a.id)} onDelete={() => removeAlert(a.id)} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function AlertRow({ alert, onToggle, onDelete }: { alert: PriceAlert; onToggle: () => void; onDelete: () => void; }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn("text-[10px] font-medium", alert.direction === "above" ? "text-tv-green" : "text-tv-red")}>
            {alert.direction === "above" ? "↑" : "↓"} {alert.targetPrice.toLocaleString("es-AR")}
          </span>
          {alert.triggered && <span className="rounded bg-amber-500/20 px-1 py-0.5 text-[9px] font-bold text-amber-400">DISPARADA</span>}
          {!alert.triggered && alert.active && <span className="rounded bg-tv-green/20 px-1 py-0.5 text-[9px] font-bold text-tv-green">ACTIVA</span>}
          {!alert.triggered && !alert.active && <span className="rounded bg-tv-border px-1 py-0.5 text-[9px] text-tv-text-muted">PAUSADA</span>}
        </div>
        <p className="text-[10px] text-tv-text-muted truncate">{alert.message}</p>
        {alert.action && (
          <p className="text-[9px] text-amber-400/70">→ {alert.action.type === "buy" ? "Comprar" : "Vender"} {alert.action.quantity} c/{alert.action.plazo}</p>
        )}
      </div>
      <button onClick={onToggle} className="shrink-0 rounded p-1 text-tv-text-muted hover:text-tv-text" title={alert.active ? "Pausar" : "Activar"}>
        {alert.active ? <Bell className="h-3.5 w-3.5 text-amber-400" /> : <BellOff className="h-3.5 w-3.5" />}
      </button>
      <button onClick={onDelete} className="shrink-0 rounded p-1 text-tv-text-muted hover:text-tv-red">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
