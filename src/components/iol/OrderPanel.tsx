"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useIolStore } from "@/lib/store/iol-store";
import { useIolQuote } from "@/hooks/useIolQuote";
import { placeIolBuyOrder, placeIolSellOrder } from "@/lib/iol/rest";
import type { IolMercado, IolPlazo, IolTipoOrden } from "@/lib/iol/types";
import { formatARSCurrency, formatPct } from "@/lib/format";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const PLAZOS: { value: IolPlazo; label: string }[] = [
  { value: "t0", label: "T+0 (Contado inmediato)" },
  { value: "t1", label: "T+1 (24 horas)" },
  { value: "t2", label: "T+2 (48 horas)" },
];

export function OrderPanel() {
  const selectedSymbol = useIolStore((s) => s.selectedSymbol);
  const { quote } = useIolQuote(selectedSymbol);

  const [cantidad, setCantidad] = useState("");
  const [precio, setPrecio] = useState("");
  const [tipoOrden, setTipoOrden] = useState<IolTipoOrden>("precioLimite");
  const [plazo, setPlazo] = useState<IolPlazo>("t0");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmSide, setConfirmSide] = useState<"comprar" | "vender">("comprar");
  const [loading, setLoading] = useState(false);
  const [resultMsg, setResultMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const priceEditedRef = useRef(false);

  // Reset price when symbol changes
  useEffect(() => {
    priceEditedRef.current = false;
    setPrecio("");
  }, [selectedSymbol]);

  // Pre-fill price from live quote; auto-refresh unless user manually edited it.
  // Solo si el precio es válido (> 0) — algunos CEDEARs sin operar devuelven 0.
  useEffect(() => {
    if (quote && quote.ultimoPrecio > 0 && !priceEditedRef.current) {
      setPrecio(quote.ultimoPrecio.toFixed(2));
    }
  }, [quote]);

  const total =
    parseFloat(cantidad || "0") * parseFloat(precio || "0");

  const openConfirm = (side: "comprar" | "vender") => {
    if (!cantidad || !precio) return;
    setConfirmSide(side);
    setConfirmOpen(true);
    setResultMsg(null);
  };

  const executeOrder = async () => {
    const cantidadNum = parseInt(cantidad);
    const precioNum = parseFloat(precio);
    if (!(cantidadNum > 0)) {
      setResultMsg({ ok: false, text: "Cantidad inválida." });
      return;
    }
    if (!(precioNum > 0)) {
      setResultMsg({
        ok: false,
        text: "Precio no disponible para este activo. Ingresá un precio manualmente en el campo Precio.",
      });
      return;
    }
    setLoading(true);
    setResultMsg(null);
    const order =
      tipoOrden === "precioMercado"
        ? {
            mercado: "bCBA" as IolMercado,
            simbolo: selectedSymbol,
            cantidad: cantidadNum,
            monto: Math.round(cantidadNum * precioNum),
            plazo,
            tipoOrden,
          }
        : {
            mercado: "bCBA" as IolMercado,
            simbolo: selectedSymbol,
            cantidad: cantidadNum,
            precio: precioNum,
            plazo,
            tipoOrden,
          };

    try {
      const result =
        confirmSide === "comprar"
          ? await placeIolBuyOrder(order)
          : await placeIolSellOrder(order);
      const num = result.numeroOperacion;
      setResultMsg({
        ok: true,
        text: num
          ? `Orden de ${confirmSide} confirmada por IOL (N° ${num}).`
          : `Orden de ${confirmSide} enviada a IOL.`,
      });
    } catch (e) {
      setResultMsg({ ok: false, text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const fmtARS = formatARSCurrency;

  return (
    <>
      <div className="border-t border-tv-border bg-tv-panel">
        <button
          onClick={() => setIsExpanded((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-3 sm:px-4 py-2.5 hover:bg-tv-panel-hover transition-colors"
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold text-tv-text">{selectedSymbol}</span>
            {quote && (
              <>
                <span className="shrink-0 text-sm tabular-nums text-tv-text">
                  {fmtARS(quote.ultimoPrecio)}
                </span>
                <span className={`shrink-0 text-xs tabular-nums ${quote.variacion >= 0 ? "text-tv-green" : "text-tv-red"}`}>
                  {formatPct(quote.variacion)}
                </span>
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden sm:inline text-xs text-tv-text-muted">Operar en BYMA</span>
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-tv-text-muted" /> : <ChevronUp className="h-3.5 w-3.5 text-tv-text-muted" />}
          </div>
        </button>

        {isExpanded && <div className="px-4 pb-3">
        <Tabs defaultValue="comprar">
          <TabsList className="bg-tv-bg mb-3 h-8">
            <TabsTrigger value="comprar" className="text-xs data-[state=active]:bg-tv-green/20 data-[state=active]:text-tv-green">
              Comprar
            </TabsTrigger>
            <TabsTrigger value="vender" className="text-xs data-[state=active]:bg-tv-red/20 data-[state=active]:text-tv-red">
              Vender
            </TabsTrigger>
          </TabsList>

          {["comprar", "vender"].map((side) => (
            <TabsContent key={side} value={side}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase tracking-wider text-tv-text-muted">
                    Cantidad
                  </label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    placeholder="0"
                    className="h-8 bg-tv-bg border-tv-border text-tv-text text-sm"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase tracking-wider text-tv-text-muted">
                    Precio (ARS)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={precio}
                    onChange={(e) => { priceEditedRef.current = true; setPrecio(e.target.value); }}
                    placeholder="0.00"
                    disabled={tipoOrden === "precioMercado"}
                    className="h-8 bg-tv-bg border-tv-border text-tv-text text-sm disabled:opacity-50"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase tracking-wider text-tv-text-muted">
                    Tipo
                  </label>
                  <Select value={tipoOrden} onValueChange={(v) => setTipoOrden(v as IolTipoOrden)}>
                    <SelectTrigger className="h-8 bg-tv-bg border-tv-border text-tv-text text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-tv-panel border-tv-border text-tv-text">
                      <SelectItem value="precioLimite" className="text-xs">Límite</SelectItem>
                      <SelectItem value="precioMercado" className="text-xs">Mercado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase tracking-wider text-tv-text-muted">
                    Plazo
                  </label>
                  <Select value={plazo} onValueChange={(v) => setPlazo(v as IolPlazo)}>
                    <SelectTrigger className="h-8 bg-tv-bg border-tv-border text-tv-text text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-tv-panel border-tv-border text-tv-text">
                      {PLAZOS.map((p) => (
                        <SelectItem key={p.value} value={p.value} className="text-xs">
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="text-xs text-tv-text-muted">
                  Total estimado:{" "}
                  <span className="text-tv-text tabular-nums font-medium">
                    {total > 0 ? fmtARS(total) : "—"}
                  </span>
                </div>
                <Button
                  onClick={() => openConfirm(side as "comprar" | "vender")}
                  disabled={!(parseInt(cantidad) > 0) || !(parseFloat(precio) > 0)}
                  className={
                    side === "comprar"
                      ? "bg-tv-green/90 hover:bg-tv-green text-white h-8 text-xs px-4"
                      : "bg-tv-red/90 hover:bg-tv-red text-white h-8 text-xs px-4"
                  }
                >
                  {side === "comprar" ? "Comprar" : "Vender"} {selectedSymbol}
                </Button>
              </div>
            </TabsContent>
          ))}
        </Tabs>
        </div>}
      </div>

      <Dialog open={confirmOpen} onOpenChange={(open) => {
        setConfirmOpen(open);
        if (!open && resultMsg?.ok) {
          setCantidad("");
          setResultMsg(null);
        }
      }}>
        <DialogContent className="bg-tv-panel border-tv-border text-tv-text sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-tv-text capitalize">
              Confirmar {confirmSide}
            </DialogTitle>
            <DialogDescription className="text-tv-text-muted">
              {parseInt(cantidad || "0")} acciones de {selectedSymbol} a{" "}
              {tipoOrden === "precioMercado" ? "precio de mercado" : fmtARS(parseFloat(precio || "0"))}{" "}
              · Plazo {plazo.toUpperCase()}
              {total > 0 && tipoOrden !== "precioMercado" && (
                <>
                  {" "}· Total {fmtARS(total)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {resultMsg && (
            <p
              className={`text-xs rounded px-3 py-2 ${
                resultMsg.ok
                  ? "text-tv-green bg-tv-green/10"
                  : "text-tv-red bg-tv-red/10"
              }`}
            >
              {resultMsg.text}
            </p>
          )}

          {!resultMsg && (
            <div className="flex gap-2 mt-2">
              <Button
                variant="outline"
                onClick={() => setConfirmOpen(false)}
                className="flex-1 border-tv-border text-tv-text-muted hover:text-tv-text"
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                onClick={executeOrder}
                disabled={loading}
                className={`flex-1 text-white ${
                  confirmSide === "comprar"
                    ? "bg-tv-green/90 hover:bg-tv-green"
                    : "bg-tv-red/90 hover:bg-tv-red"
                }`}
              >
                {loading ? "Enviando…" : "Confirmar"}
              </Button>
            </div>
          )}

          {resultMsg && (
            <Button
              onClick={() => {
                setConfirmOpen(false);
                if (resultMsg.ok) setCantidad("");
                setResultMsg(null);
              }}
              variant="outline"
              className="border-tv-border text-tv-text-muted hover:text-tv-text"
            >
              Cerrar
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
