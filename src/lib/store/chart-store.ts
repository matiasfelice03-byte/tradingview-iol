"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Timeframe } from "@/lib/binance/types";

export type IndicatorKey =
  | "ema20"
  | "ema50"
  | "ema200"
  | "rsi"
  | "macd"
  | "volume";

export type DrawingTool = "cursor" | "hline" | "measure" | "eraser" | "fibonacci" | "fibext" | "pricerange" | "trendline";

export interface PriceLine {
  id: string;
  symbol: string;
  price: number;
  color?: string;
  label?: string;
}

export interface FibDrawing {
  id: string;
  symbol: string;
  type: "retracement" | "extension";
  highPrice: number;
  lowPrice: number;
  // Extensión de 3 puntos: A = inicio del impulso, B = fin del impulso, C = fin del retroceso.
  pointA?: number;
  pointB?: number;
  pointC?: number;
  color?: string;
}

export interface PriceRangeDrawing {
  id: string;
  symbol: string;
  highPrice: number;
  lowPrice: number;
  color?: string;
}

export interface TrendLinePoint {
  time: number;
  price: number;
}

export interface TrendLineDrawing {
  id: string;
  symbol: string;
  points: TrendLinePoint[];
  color?: string;
}

export interface IndicatorConfig {
  ema20: number;
  ema50: number;
  ema200: number;
  rsi: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
}

export const DEFAULT_CONFIG: IndicatorConfig = {
  ema20: 20,
  ema50: 50,
  ema200: 200,
  rsi: 14,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
};

export const INDICATOR_COLORS: Record<IndicatorKey, string> = {
  ema20: "#ffb74d",
  ema50: "#2962ff",
  ema200: "#ab47bc",
  rsi: "#ab47bc",
  macd: "#2962ff",
  volume: "#787b86",
};

export const DEFAULT_WATCHLIST = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "ADAUSDT",
  "AVAXUSDT",
  "LINKUSDT",
  "MATICUSDT",
];

interface ChartState {
  symbol: string;
  timeframe: Timeframe;
  /** Indicator is added to the chart (appears in pill + renders unless hidden) */
  indicators: Record<IndicatorKey, boolean>;
  /** Indicator is hidden (eye icon off) — kept in pill list, just not rendered */
  hidden: Record<IndicatorKey, boolean>;
  /** Periods and parameters for each indicator */
  config: IndicatorConfig;
  watchlist: string[];

  magnet: boolean;

  // Ephemeral UI state (not persisted)
  tool: DrawingTool;
  priceLines: PriceLine[];
  fibDrawings: FibDrawing[];
  priceRanges: PriceRangeDrawing[];
  trendLines: TrendLineDrawing[];
  symbolDialogOpen: boolean;
  /** Which indicator's settings dialog is open (null = closed) */
  settingsTarget: IndicatorKey | null;

  // Actions
  setMagnet: (v: boolean) => void;
  setSymbol: (s: string) => void;
  setTimeframe: (t: Timeframe) => void;
  toggleIndicator: (key: IndicatorKey) => void;
  removeIndicator: (key: IndicatorKey) => void;
  toggleHidden: (key: IndicatorKey) => void;
  setConfig: (patch: Partial<IndicatorConfig>) => void;
  addToWatchlist: (s: string) => void;
  removeFromWatchlist: (s: string) => void;
  setTool: (t: DrawingTool) => void;
  addPriceLine: (price: number, symbol: string, color?: string, label?: string) => void;
  clearPriceLines: (symbol?: string) => void;
  addFibDrawing: (d: Omit<FibDrawing, "id">) => void;
  removeFibDrawing: (id: string) => void;
  updateFibDrawing: (id: string, patch: Partial<Pick<FibDrawing, "type" | "color">>) => void;
  clearFibDrawings: (symbol?: string) => void;
  removePriceLine: (id: string) => void;
  updatePriceLineColor: (id: string, color: string) => void;
  addPriceRange: (d: Omit<PriceRangeDrawing, "id">) => void;
  removePriceRange: (id: string) => void;
  updatePriceRangeColor: (id: string, color: string) => void;
  clearPriceRanges: (symbol?: string) => void;
  addTrendLine: (d: Omit<TrendLineDrawing, "id">) => void;
  removeTrendLine: (id: string) => void;
  updateTrendLineColor: (id: string, color: string) => void;
  clearTrendLines: (symbol?: string) => void;
  setSymbolDialogOpen: (v: boolean) => void;
  setSettingsTarget: (k: IndicatorKey | null) => void;
}

export const useChartStore = create<ChartState>()(
  persist(
    (set) => ({
      magnet: false,
      symbol: "BTCUSDT",
      timeframe: "15m" as Timeframe,
      indicators: {
        ema20: true,
        ema50: true,
        ema200: false,
        rsi: true,
        macd: false,
        volume: true,
      },
      hidden: {
        ema20: false,
        ema50: false,
        ema200: false,
        rsi: false,
        macd: false,
        volume: false,
      },
      config: { ...DEFAULT_CONFIG },
      watchlist: DEFAULT_WATCHLIST,
      tool: "cursor",
      priceLines: [],
      fibDrawings: [],
      priceRanges: [],
      trendLines: [],
      symbolDialogOpen: false,
      settingsTarget: null,

      setMagnet: (magnet) => set({ magnet }),
      setSymbol: (symbol) => set({ symbol }),
      setTimeframe: (timeframe) => set({ timeframe }),
      toggleIndicator: (key) =>
        set((s) => ({
          indicators: { ...s.indicators, [key]: !s.indicators[key] },
          // When re-adding, ensure not hidden
          hidden: !s.indicators[key]
            ? { ...s.hidden, [key]: false }
            : s.hidden,
        })),
      removeIndicator: (key) =>
        set((s) => ({
          indicators: { ...s.indicators, [key]: false },
          hidden: { ...s.hidden, [key]: false },
        })),
      toggleHidden: (key) =>
        set((s) => ({ hidden: { ...s.hidden, [key]: !s.hidden[key] } })),
      setConfig: (patch) =>
        set((s) => ({ config: { ...s.config, ...patch } })),
      addToWatchlist: (s) =>
        set((state) => ({
          watchlist: state.watchlist.includes(s)
            ? state.watchlist
            : [...state.watchlist, s],
        })),
      removeFromWatchlist: (s) =>
        set((state) => ({
          watchlist: state.watchlist.filter((x) => x !== s),
        })),
      setTool: (tool) => set({ tool }),
      addPriceLine: (price, symbol, color, label) =>
        set((state) => ({
          priceLines: [
            ...state.priceLines,
            {
              id:
                typeof crypto !== "undefined" && "randomUUID" in crypto
                  ? crypto.randomUUID()
                  : `${Date.now()}-${Math.random()}`,
              symbol,
              price,
              ...(color ? { color } : {}),
              ...(label ? { label } : {}),
            },
          ],
        })),
      clearPriceLines: (symbol) =>
        set((state) => ({
          priceLines: symbol
            ? state.priceLines.filter((p) => p.symbol !== symbol)
            : [],
        })),
      addFibDrawing: (d) =>
        set((state) => ({
          fibDrawings: [
            ...state.fibDrawings,
            {
              ...d,
              id: typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random()}`,
            },
          ],
        })),
      removeFibDrawing: (id) =>
        set((state) => ({ fibDrawings: state.fibDrawings.filter((d) => d.id !== id) })),
      updateFibDrawing: (id, patch) =>
        set((state) => ({
          fibDrawings: state.fibDrawings.map((d) => d.id === id ? { ...d, ...patch } : d),
        })),
      clearFibDrawings: (symbol) =>
        set((state) => ({
          fibDrawings: symbol
            ? state.fibDrawings.filter((d) => d.symbol !== symbol)
            : [],
        })),
      removePriceLine: (id) =>
        set((state) => ({ priceLines: state.priceLines.filter((p) => p.id !== id) })),
      updatePriceLineColor: (id, color) =>
        set((state) => ({
          priceLines: state.priceLines.map((p) => p.id === id ? { ...p, color } : p),
        })),
      addPriceRange: (d) =>
        set((state) => ({
          priceRanges: [...state.priceRanges, {
            ...d,
            id: typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
          }],
        })),
      removePriceRange: (id) =>
        set((state) => ({ priceRanges: state.priceRanges.filter((r) => r.id !== id) })),
      updatePriceRangeColor: (id, color) =>
        set((state) => ({
          priceRanges: state.priceRanges.map((r) => r.id === id ? { ...r, color } : r),
        })),
      clearPriceRanges: (symbol) =>
        set((state) => ({
          priceRanges: symbol ? state.priceRanges.filter((r) => r.symbol !== symbol) : [],
        })),
      addTrendLine: (d) =>
        set((state) => ({
          trendLines: [...state.trendLines, {
            ...d,
            id: typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
          }],
        })),
      removeTrendLine: (id) =>
        set((state) => ({ trendLines: state.trendLines.filter((t) => t.id !== id) })),
      updateTrendLineColor: (id, color) =>
        set((state) => ({
          trendLines: state.trendLines.map((t) => t.id === id ? { ...t, color } : t),
        })),
      clearTrendLines: (symbol) =>
        set((state) => ({
          trendLines: symbol ? state.trendLines.filter((t) => t.symbol !== symbol) : [],
        })),
      setSymbolDialogOpen: (symbolDialogOpen) => set({ symbolDialogOpen }),
      setSettingsTarget: (settingsTarget) => set({ settingsTarget }),
    }),
    {
      name: "tv-gratis-chart-state",
      partialize: (s) => ({
        magnet: s.magnet,
        symbol: s.symbol,
        timeframe: s.timeframe,
        indicators: s.indicators,
        hidden: s.hidden,
        config: s.config,
        watchlist: s.watchlist,
      }),
    },
  ),
);
