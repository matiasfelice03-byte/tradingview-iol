"use client";

import { useEffect, useRef } from "react";
import { X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  "#787b86", "#ef5350", "#26a69a", "#2962ff",
  "#ffb74d", "#ab47bc", "#ffffff", "#ffeb3b",
];

interface BaseProps {
  x: number;
  y: number;
  color?: string;
  onColorChange: (color: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

interface FibProps extends BaseProps {
  kind: "fib";
  fibType: "retracement" | "extension";
  onFibTypeChange: (t: "retracement" | "extension") => void;
}

interface HlineProps extends BaseProps {
  kind: "hline";
}

type Props = FibProps | HlineProps;

export function DrawingContextMenu(props: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) props.onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
      if (e.key === "Delete" || e.key === "Backspace") { props.onDelete(); props.onClose(); }
    };
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, [props]);

  return (
    <div
      ref={ref}
      className="absolute z-50 w-48 rounded border border-tv-border bg-tv-panel p-2 shadow-xl"
      style={{ left: props.x, top: props.y + 6 }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-tv-text">
          {props.kind === "fib" ? "Fibonacci" : "Línea horizontal"}
        </span>
        <button onClick={props.onClose} className="rounded p-0.5 text-tv-text-muted hover:text-tv-text">
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Fib type toggle */}
      {props.kind === "fib" && (
        <div className="mb-2 flex gap-1">
          <button
            onClick={() => props.onFibTypeChange("retracement")}
            className={cn(
              "flex-1 rounded px-1.5 py-1 text-[10px] font-medium transition-colors",
              props.fibType === "retracement"
                ? "bg-tv-blue/20 text-tv-blue"
                : "text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text",
            )}
          >
            Retroceso
          </button>
          <button
            onClick={() => props.onFibTypeChange("extension")}
            className={cn(
              "flex-1 rounded px-1.5 py-1 text-[10px] font-medium transition-colors",
              props.fibType === "extension"
                ? "bg-tv-blue/20 text-tv-blue"
                : "text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text",
            )}
          >
            Extensión
          </button>
        </div>
      )}

      {/* Color swatches */}
      <div className="mb-2 flex flex-wrap gap-1">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => props.onColorChange(c)}
            title={c}
            className="h-5 w-5 rounded border border-tv-border transition-transform hover:scale-110"
            style={{
              backgroundColor: c,
              boxShadow: props.color === c ? `0 0 0 2px #fff` : undefined,
            }}
          />
        ))}
      </div>

      {/* Delete */}
      <button
        onClick={() => { props.onDelete(); props.onClose(); }}
        className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-[11px] text-tv-red hover:bg-tv-red/10"
      >
        <Trash2 className="h-3 w-3" />
        Eliminar  (Del)
      </button>
    </div>
  );
}
