"use client";

import { useState, useRef, useEffect } from "react";
import { MousePointer2, Minus, Ruler, Trash2, TrendingUp, Magnet, RectangleHorizontal, Slash } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useChartStore } from "@/lib/store/chart-store";
import { useIolStore } from "@/lib/store/iol-store";
import { cn } from "@/lib/utils";

export function IolLeftSidebar() {
  const tool = useChartStore((s) => s.tool);
  const setTool = useChartStore((s) => s.setTool);
  const magnet = useChartStore((s) => s.magnet);
  const setMagnet = useChartStore((s) => s.setMagnet);
  const clearPriceLines = useChartStore((s) => s.clearPriceLines);
  const clearFibDrawings = useChartStore((s) => s.clearFibDrawings);
  const clearPriceRanges = useChartStore((s) => s.clearPriceRanges);
  const clearTrendLines = useChartStore((s) => s.clearTrendLines);
  const selectedSymbol = useIolStore((s) => s.selectedSymbol);

  const [fibOpen, setFibOpen] = useState(false);
  const fibRef = useRef<HTMLDivElement>(null);

  const isFibActive = tool === "fibonacci" || tool === "fibext";

  const [linesOpen, setLinesOpen] = useState(false);
  const linesRef = useRef<HTMLDivElement>(null);
  const isLinesActive = tool === "hline" || tool === "trendline";

  useEffect(() => {
    if (!fibOpen) return;
    const handler = (e: MouseEvent) => {
      if (fibRef.current && !fibRef.current.contains(e.target as Node)) setFibOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [fibOpen]);

  useEffect(() => {
    if (!linesOpen) return;
    const handler = (e: MouseEvent) => {
      if (linesRef.current && !linesRef.current.contains(e.target as Node)) setLinesOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [linesOpen]);

  return (
    <aside className="flex w-11 flex-col items-center gap-0.5 border-r border-tv-border bg-tv-panel py-1.5">
      {/* Cursor */}
      <Tooltip>
        <TooltipTrigger
          onClick={() => setTool("cursor")}
          aria-label="Cursor"
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-tv-panel-hover",
            tool === "cursor" ? "bg-tv-blue/15 text-tv-blue" : "text-tv-text-muted hover:text-tv-text",
          )}
        >
          <MousePointer2 className="h-4 w-4" />
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs"><div className="font-medium">Cursor</div></TooltipContent>
      </Tooltip>

      {/* Líneas dropdown */}
      <div ref={linesRef} className="relative">
        <Tooltip>
          <TooltipTrigger
            onClick={() => setLinesOpen((v) => !v)}
            aria-label="Líneas de tendencia"
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-tv-panel-hover",
              isLinesActive || linesOpen ? "bg-tv-blue/15 text-tv-blue" : "text-tv-text-muted hover:text-tv-text",
            )}
          >
            <Slash className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            <div className="font-medium">Líneas de tendencia</div>
            <div className="mt-0.5 text-[10px] text-tv-text-muted">Horizontal o tendencia (varios puntos)</div>
          </TooltipContent>
        </Tooltip>

        {linesOpen && (
          <div className="absolute left-full top-0 ml-1.5 z-50 w-52 rounded border border-tv-border bg-tv-panel shadow-lg overflow-hidden">
            <button
              onClick={() => { setTool("hline"); setLinesOpen(false); }}
              className={cn("flex w-full items-center gap-2 px-3 py-2 text-[11px] font-medium transition-colors hover:bg-tv-panel-hover", tool === "hline" ? "text-tv-blue" : "text-tv-text")}
            >
              <Minus className="h-3.5 w-3.5 shrink-0" />
              Línea horizontal
            </button>
            <button
              onClick={() => { setTool("trendline"); setLinesOpen(false); }}
              className={cn("flex w-full items-center gap-2 px-3 py-2 text-[11px] font-medium transition-colors hover:bg-tv-panel-hover", tool === "trendline" ? "text-tv-blue" : "text-tv-text")}
            >
              <Slash className="h-3.5 w-3.5 shrink-0" />
              <span className="flex flex-col items-start">
                Línea de tendencia
                <span className="text-[9px] text-tv-text-muted">Click por punto · botón Finalizar</span>
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Measure */}
      <Tooltip>
        <TooltipTrigger
          onClick={() => setTool("measure")}
          aria-label="Regla / Medir"
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-tv-panel-hover",
            tool === "measure" ? "bg-tv-blue/15 text-tv-blue" : "text-tv-text-muted hover:text-tv-text",
          )}
        >
          <Ruler className="h-4 w-4" />
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          <div className="font-medium">Regla / Medir</div>
          <div className="mt-0.5 text-[10px] text-tv-text-muted">Click en dos puntos para medir</div>
        </TooltipContent>
      </Tooltip>

      {/* Fibonacci dropdown */}
      <div ref={fibRef} className="relative">
        <Tooltip>
          <TooltipTrigger
            onClick={() => setFibOpen((v) => !v)}
            aria-label="Fibonacci"
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-tv-panel-hover",
              isFibActive || fibOpen ? "bg-tv-blue/15 text-tv-blue" : "text-tv-text-muted hover:text-tv-text",
            )}
          >
            <TrendingUp className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            <div className="font-medium">Fibonacci</div>
            <div className="mt-0.5 text-[10px] text-tv-text-muted">Retroceso o extensión</div>
          </TooltipContent>
        </Tooltip>

        {fibOpen && (
          <div className="absolute left-full top-0 ml-1.5 z-50 w-36 rounded border border-tv-border bg-tv-panel shadow-lg overflow-hidden">
            <button
              onClick={() => { setTool("fibonacci"); setFibOpen(false); }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-[11px] font-medium transition-colors hover:bg-tv-panel-hover",
                tool === "fibonacci" ? "text-tv-blue" : "text-tv-text",
              )}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Retroceso
            </button>
            <button
              onClick={() => { setTool("fibext"); setFibOpen(false); }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-[11px] font-medium transition-colors hover:bg-tv-panel-hover",
                tool === "fibext" ? "text-tv-blue" : "text-tv-text",
              )}
            >
              <TrendingUp className="h-3.5 w-3.5 rotate-180" />
              Extensión
            </button>
          </div>
        )}
      </div>

      <Tooltip>
        <TooltipTrigger
          onClick={() => setTool("pricerange")}
          aria-label="Zona de precio"
          className={cn("flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-tv-panel-hover", tool === "pricerange" ? "bg-tv-blue/15 text-tv-blue" : "text-tv-text-muted hover:text-tv-text")}
        >
          <RectangleHorizontal className="h-4 w-4" />
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          <div className="font-medium">Zona de precio</div>
          <div className="mt-0.5 text-[10px] text-tv-text-muted">Marca soporte o resistencia entre dos niveles</div>
        </TooltipContent>
      </Tooltip>

      <div className="my-0.5 h-px w-6 bg-tv-border" />

      <Tooltip>
        <TooltipTrigger
          onClick={() => setMagnet(!magnet)}
          aria-label="Imán débil"
          className={cn("flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-tv-panel-hover", magnet ? "bg-tv-blue/15 text-tv-blue" : "text-tv-text-muted hover:text-tv-text")}
        >
          <Magnet className="h-4 w-4" />
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          <div className="font-medium">Imán débil {magnet ? "(activo)" : "(inactivo)"}</div>
          <div className="mt-0.5 text-[10px] text-tv-text-muted">Adhiere al OHLC más cercano al dibujar</div>
        </TooltipContent>
      </Tooltip>

      {/* Trash */}
      <Tooltip>
        <TooltipTrigger
          onClick={() => { clearPriceLines(selectedSymbol); clearFibDrawings(selectedSymbol); clearPriceRanges(selectedSymbol); clearTrendLines(selectedSymbol); }}
          aria-label="Borrar dibujos"
          className="flex h-8 w-8 items-center justify-center rounded text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-red"
        >
          <Trash2 className="h-4 w-4" />
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          <div className="font-medium">Borrar dibujos</div>
          <div className="mt-0.5 text-[10px] text-tv-text-muted">Limpia las líneas de este símbolo</div>
        </TooltipContent>
      </Tooltip>
    </aside>
  );
}
