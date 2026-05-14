"use client";

import { useState, useEffect } from "react";
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
  const [plazo, setPlazo] = useState<IolPlazo>("t2");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmSide, setConfirmSide] = useState<"comprar" | "vender">("comprar");
  const [loading, setLoading] = useState(false);
  const [resultMsg, setResultMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Pre-fill price from live quote
  useEffect(() => {
    if (quote && !precio) {
      setPrecio(quote.ultimoPrecio.toFixed(2));
    }
  }, [quote, precio]);

  const total =
    parseFloat(cantidad || "0") * parseFloat(precio || "0");

  const openConfirm = (side: "comprar" | "vender") => {
    if (!cantidad || !precio) return;
    setConfirmSide(side);
    setConfirmOpen(true);
    setResultMsg(null);
  };

  const executeOrder = async () => {
    setLoading(true);
    setResultMsg(null);
    const order = {
      mercado: "bCBA" as IolMercado,
      simbolo: selectedSymbol,
      cantidad: parseInt(cantidad),
      precio: parseFloat(precio),
      plazo,
      tipoOrden,
    };

    try {
      if (confirmSide === "comprar") {
        await placeIolBuyOrder(order);
      } else {
        await placeIolSellOrder(order);
      }
      setResultMsg({ ok: true, text: `Orden de ${confirmSide} enviada a IOL.` });
      setCantidad("");
    } catch (e) {
      setResultMsg({ ok: false, text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const fmtARS = formatARSCurrency;

  return (
    <>
      <div className="border-t border-tv-border bg-tv-panel px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-tv-text">{selectedSymbol}</span>
            {quote && (
              <>
                <span className="text-sm tabular-nums text-tv-text">
                  {fmtARS(quote.ultimoPrecio)}
                </span>
                <span
                  className={`text-xs tabular-nums ${
                    quote.variacion >= 0 ? "text-tv-green" : "text-tv-red"
                  }`}
                >
                  {formatPct(quote.variacion)}
                </span>
              </>
            )}
          </div>
          <span className="text-xs text-tv-text-muted">Operar en BYMA</span>
        </div>

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
                    onChange={(e) => setPrecio(e.target.value)}
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
                  disabled={!cantidad || (!precio && tipoOrden !== "precioMercado")}
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
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
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
              onClick={() => setConfirmOpen(false)}
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
