"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type UTCTimestamp,
  type Logical,
} from "lightweight-charts";
import { fetchKlines } from "@/lib/binance/rest";
import { getBinanceWS } from "@/lib/binance/ws";
import { ema, rsi, macd } from "@/lib/indicators";
import type { Candle, Timeframe } from "@/lib/binance/types";
import {
  INDICATOR_COLORS,
  useChartStore,
  type IndicatorKey,
  type TrendLinePoint,
} from "@/lib/store/chart-store";
import { formatPrice, formatVolume } from "@/lib/format";
import { IndicatorPill } from "./IndicatorPill";
import { MeasureOverlay } from "./MeasureOverlay";
import { FibonacciOverlay, computeFibLevels, computeFibExtensionLevels, RETRACEMENT_LEVELS, EXTENSION_LEVELS } from "./FibonacciOverlay";
import { PriceRangeOverlay } from "./PriceRangeOverlay";
import { TrendLineOverlay, distanceToPolyline, type PixelPoint } from "./TrendLineOverlay";
import { DrawingContextMenu } from "./DrawingContextMenu";
import { AiPanel, type ChartAction } from "@/components/ai/AiPanel";
import { AlertsPanel } from "@/components/chart/AlertsPanel";

interface MeasurePoint {
  time: number;
  price: number;
}
interface MeasureState {
  phase: "idle" | "placing" | "done";
  a: MeasurePoint | null;
  b: MeasurePoint | null;
}
const INITIAL_MEASURE: MeasureState = { phase: "idle", a: null, b: null };

interface FibSketch { phase: "idle" | "placingB" | "placingC"; a: number | null; b: number | null; c: number | null; }
const INITIAL_FIB: FibSketch = { phase: "idle", a: null, b: null, c: null };

interface PriceRangeSketch { phase: "idle" | "placing"; a: number | null; b: number | null; }
const INITIAL_PRICERANGE: PriceRangeSketch = { phase: "idle", a: null, b: null };

interface TrendSketch { points: TrendLinePoint[]; cursor: TrendLinePoint | null; }
const INITIAL_TREND: TrendSketch = { points: [], cursor: null };

/** Convierte los puntos que manda la IA (fecha + precio, con claves flexibles) a
 *  TrendLinePoint[]. Snapea fechas dentro del rango a la vela real más cercana;
 *  las fechas futuras se dejan para proyectar. */
function aiPointsToTrend(raw: unknown, candles: { time: number }[]): TrendLinePoint[] {
  if (!Array.isArray(raw)) return [];
  const toTs = (v: unknown): number => {
    if (typeof v === "number") return v > 1e12 ? Math.floor(v / 1000) : Math.floor(v);
    if (typeof v !== "string" || !v.trim()) return NaN;
    let s = v.trim();
    if (/[zZ]$|[+-]\d\d:?\d\d$/.test(s)) return Math.floor(new Date(s).getTime() / 1000);
    s = s.replace(" ", "T");
    if (s.length === 10) s += "T00:00:00";       // YYYY-MM-DD
    else if (s.length === 16) s += ":00";         // YYYY-MM-DDTHH:MM
    return Math.floor(new Date(s + "Z").getTime() / 1000);
  };
  const lastT = candles.length ? Number(candles[candles.length - 1].time) : 0;
  const out: TrendLinePoint[] = [];
  for (const p of raw) {
    if (!p || typeof p !== "object") continue;
    const o = p as Record<string, unknown>;
    const price = Number(o.price ?? o.precio ?? o.value ?? o.y);
    let time = toTs(o.date ?? o.time ?? o.fecha ?? o.x ?? o.t);
    if (!isFinite(price) || !isFinite(time)) continue;
    if (time <= lastT && candles.length >= 2) {
      let bestT = Number(candles[0].time), bestDiff = Infinity;
      for (const c of candles) {
        const d = Math.abs(Number(c.time) - time);
        if (d < bestDiff) { bestDiff = d; bestT = Number(c.time); }
      }
      time = bestT;
    }
    out.push({ time, price });
  }
  return out;
}

function durationLabel(aTime: number, bTime: number): string {
  const diff = Math.abs(bTime - aTime);
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}

interface Props {
  symbol: string;
  timeframe: Timeframe;
}

const TV_COLORS = {
  bg: "#131722",
  panel: "#1e222d",
  border: "#2a2e39",
  text: "#d1d4dc",
  textMuted: "#787b86",
  green: "#26a69a",
  red: "#ef5350",
  blue: "#2962ff",
  yellow: "#ffb74d",
  purple: "#ab47bc",
  grid: "#1e222d",
};

interface HoverInfo {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  time: number;
  pct: number;
}

interface LastValues {
  ema20?: number;
  ema50?: number;
  ema200?: number;
  rsi?: number;
  macd?: number;
  macdSignal?: number;
  macdHist?: number;
  volume?: number;
}

function snapToOHLC(
  rawPrice: number,
  time: number,
  candles: Candle[],
  priceToCoord: (p: number) => number | null,
  thresholdPx = 20,
): number {
  const c = candles.find((x) => Number(x.time) === time)
    ?? candles.reduce<Candle | null>((b, x) => !b || Math.abs(Number(x.time) - time) < Math.abs(Number(b.time) - time) ? x : b, null);
  if (!c) return rawPrice;
  const rawY = priceToCoord(rawPrice);
  if (rawY === null) return rawPrice;
  let nearest = rawPrice;
  let minDist = thresholdPx;
  for (const p of [c.open, c.high, c.low, c.close]) {
    const y = priceToCoord(p);
    if (y === null) continue;
    const dist = Math.abs(y - rawY);
    if (dist < minDist) { minDist = dist; nearest = p; }
  }
  return nearest;
}

interface PaneOffset {
  top: number;
  height: number;
}

export function PriceChart({ symbol, timeframe }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ema20Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema200Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiRef = useRef<ISeriesApi<"Line"> | null>(null);
  const rsi30Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const rsi70Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const macdRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdSignalRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdHistRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const candlesRef = useRef<Candle[]>([]);
  const priceLinesMapRef = useRef<Map<string, IPriceLine>>(new Map());

  const indicators = useChartStore((s) => s.indicators);
  const hidden = useChartStore((s) => s.hidden);
  const config = useChartStore((s) => s.config);
  const tool = useChartStore((s) => s.tool);
  const setTool = useChartStore((s) => s.setTool);
  const magnet = useChartStore((s) => s.magnet);
  const priceLines = useChartStore((s) => s.priceLines);
  const addPriceLine = useChartStore((s) => s.addPriceLine);
  const removePriceLine = useChartStore((s) => s.removePriceLine);
  const updatePriceLineColor = useChartStore((s) => s.updatePriceLineColor);
  const fibDrawings = useChartStore((s) => s.fibDrawings);
  const addFibDrawing = useChartStore((s) => s.addFibDrawing);
  const removeFibDrawing = useChartStore((s) => s.removeFibDrawing);
  const updateFibDrawing = useChartStore((s) => s.updateFibDrawing);
  const priceRanges = useChartStore((s) => s.priceRanges);
  const addPriceRange = useChartStore((s) => s.addPriceRange);
  const removePriceRange = useChartStore((s) => s.removePriceRange);
  const updatePriceRangeColor = useChartStore((s) => s.updatePriceRangeColor);
  const toggleIndicator = useChartStore((s) => s.toggleIndicator);
  const removeIndicator = useChartStore((s) => s.removeIndicator);
  const toggleHidden = useChartStore((s) => s.toggleHidden);
  const setSettingsTarget = useChartStore((s) => s.setSettingsTarget);
  const clearPriceLines = useChartStore((s) => s.clearPriceLines);
  const clearPriceRanges = useChartStore((s) => s.clearPriceRanges);
  const clearFibDrawings = useChartStore((s) => s.clearFibDrawings);
  const trendLines = useChartStore((s) => s.trendLines);
  const addTrendLine = useChartStore((s) => s.addTrendLine);
  const removeTrendLine = useChartStore((s) => s.removeTrendLine);
  const updateTrendLineColor = useChartStore((s) => s.updateTrendLineColor);
  const clearTrendLines = useChartStore((s) => s.clearTrendLines);
  const setSymbolStore = useChartStore((s) => s.setSymbol);
  const setTimeframeStore = useChartStore((s) => s.setTimeframe);

  // Refs to avoid recreating subscribeClick on every tool change
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const addPriceLineRef = useRef(addPriceLine);
  addPriceLineRef.current = addPriceLine;
  const addFibDrawingRef = useRef(addFibDrawing);
  addFibDrawingRef.current = addFibDrawing;
  const addPriceRangeRef = useRef(addPriceRange);
  addPriceRangeRef.current = addPriceRange;
  const setToolRef = useRef(setTool);
  setToolRef.current = setTool;
  const symbolRef = useRef(symbol);
  symbolRef.current = symbol;
  const configRef = useRef(config);
  configRef.current = config;
  const magnetRef = useRef(magnet);
  magnetRef.current = magnet;
  const settingCrosshairRef = useRef(false);
  const fibDrawingsRef = useRef(fibDrawings);
  fibDrawingsRef.current = fibDrawings;
  const priceLinesRef = useRef(priceLines);
  priceLinesRef.current = priceLines;
  const priceRangesRef = useRef(priceRanges);
  priceRangesRef.current = priceRanges;
  const trendLinesRef = useRef(trendLines);
  trendLinesRef.current = trendLines;
  const lastClickRef = useRef<{ ts: number; x: number; y: number } | null>(null);

  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [lastPrice, setLastPrice] = useState<{ value: number; pct: number } | null>(null);
  const [lastValues, setLastValues] = useState<LastValues>({});
  const [paneOffsets, setPaneOffsets] = useState<PaneOffset[]>([]);
  const [measure, setMeasure] = useState<MeasureState>(INITIAL_MEASURE);
  const [fibSketch, setFibSketch] = useState<FibSketch>(INITIAL_FIB);
  const [priceRangeSketch, setPriceRangeSketch] = useState<PriceRangeSketch>(INITIAL_PRICERANGE);
  const [trendSketch, setTrendSketch] = useState<TrendSketch>(INITIAL_TREND);
  const [renderTick, setRenderTick] = useState(0);
  const [contextMenu, setContextMenu] = useState<{ kind: "fib" | "hline" | "pricerange" | "trendline"; id: string; x: number; y: number } | null>(null);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const measureRef = useRef(measure);
  measureRef.current = measure;
  const fibSketchRef = useRef(fibSketch);
  fibSketchRef.current = fibSketch;
  const priceRangeSketchRef = useRef(priceRangeSketch);
  priceRangeSketchRef.current = priceRangeSketch;
  const trendSketchRef = useRef(trendSketch);
  trendSketchRef.current = trendSketch;

  // Helper — compute pane top offsets from chart layout
  function recomputePaneOffsets() {
    if (!chartRef.current) return;
    const panes = chartRef.current.panes();
    let top = 0;
    const offsets: PaneOffset[] = panes.map((p) => {
      const h = p.getHeight();
      const o = { top, height: h };
      top += h;
      return o;
    });
    setPaneOffsets(offsets);
  }

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: TV_COLORS.bg },
        textColor: TV_COLORS.text,
        fontFamily: "var(--font-sans), Inter, system-ui, sans-serif",
        fontSize: 11,
        panes: { separatorColor: TV_COLORS.border, separatorHoverColor: TV_COLORS.border },
      },
      grid: {
        vertLines: { color: TV_COLORS.grid },
        horzLines: { color: TV_COLORS.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: TV_COLORS.textMuted, width: 1, style: 3, labelBackgroundColor: TV_COLORS.panel },
        horzLine: { color: TV_COLORS.textMuted, width: 1, style: 3, labelBackgroundColor: TV_COLORS.panel },
      },
      rightPriceScale: {
        borderColor: TV_COLORS.border,
        textColor: TV_COLORS.textMuted,
      },
      timeScale: {
        borderColor: TV_COLORS.border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 8,
      },
      autoSize: true,
    });

    // PANE 0 — Candles + EMAs
    candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: TV_COLORS.green,
      downColor: TV_COLORS.red,
      borderUpColor: TV_COLORS.green,
      borderDownColor: TV_COLORS.red,
      wickUpColor: TV_COLORS.green,
      wickDownColor: TV_COLORS.red,
      priceLineColor: TV_COLORS.textMuted,
      priceLineStyle: 2,
    });

    ema20Ref.current = chart.addSeries(LineSeries, {
      color: INDICATOR_COLORS.ema20,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ema50Ref.current = chart.addSeries(LineSeries, {
      color: INDICATOR_COLORS.ema50,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    chartRef.current = chart;

    // Click handler
    chart.subscribeClick((param) => {
      if (!param.point || !candleSeriesRef.current) return;
      const rawPrice = candleSeriesRef.current.coordinateToPrice(param.point.y);
      if (rawPrice === null || !isFinite(rawPrice)) return;
      let price: number = Number(rawPrice);

      if (magnetRef.current && param.time) {
        price = snapToOHLC(price, Number(param.time), candlesRef.current,
          (p) => candleSeriesRef.current?.priceToCoordinate(p) ?? null);
      }

      const clickY = param.point.y;
      const clickX = param.point.x;
      const now = Date.now();
      const prev = lastClickRef.current;
      const isDoubleClick = prev !== null && (now - prev.ts < 400) && Math.abs(clickY - prev.y) < 20;
      lastClickRef.current = { ts: now, x: clickX, y: clickY };

      if (toolRef.current === "cursor") {
        if (!isDoubleClick) { setContextMenu(null); setSelectedDrawingId(null); return; }
        const sym = symbolRef.current;
        const series = candleSeriesRef.current;
        for (const pl of priceLinesRef.current.filter((p) => p.symbol === sym)) {
          const lineY = series.priceToCoordinate(pl.price);
          if (lineY !== null && Math.abs(lineY - clickY) < 8) {
            setSelectedDrawingId(pl.id);
            setContextMenu({ kind: "hline", id: pl.id, x: clickX, y: lineY });
            return;
          }
        }
        for (const d of fibDrawingsRef.current.filter((f) => f.symbol === sym)) {
          const yH = series.priceToCoordinate(d.highPrice);
          const yL = series.priceToCoordinate(d.lowPrice);
          if (yH !== null && yL !== null) {
            const top = Math.min(yH, yL) - 8;
            const bot = Math.max(yH, yL) + 8;
            if (clickY >= top && clickY <= bot) {
              setSelectedDrawingId(d.id);
              setContextMenu({ kind: "fib", id: d.id, x: clickX, y: (top + bot) / 2 });
              return;
            }
          }
        }
        for (const r of priceRangesRef.current.filter((r) => r.symbol === sym)) {
          const yH = series.priceToCoordinate(r.highPrice);
          const yL = series.priceToCoordinate(r.lowPrice);
          if (yH !== null && yL !== null) {
            const top = Math.min(yH, yL);
            const bot = Math.max(yH, yL);
            if (clickY >= top - 6 && clickY <= bot + 6) {
              setSelectedDrawingId(r.id);
              setContextMenu({ kind: "pricerange", id: r.id, x: clickX, y: (top + bot) / 2 });
              return;
            }
          }
        }
        const tsApiSel = chartRef.current?.timeScale();
        if (tsApiSel) {
          for (const t of trendLinesRef.current.filter((t) => t.symbol === sym)) {
            const px: PixelPoint[] = [];
            for (const pt of t.points) {
              const x = tsApiSel.timeToCoordinate(pt.time as UTCTimestamp);
              const y = series.priceToCoordinate(pt.price);
              if (x !== null && y !== null) px.push({ x, y });
            }
            if (px.length >= 2 && distanceToPolyline(clickX, clickY, px) < 8) {
              setSelectedDrawingId(t.id);
              setContextMenu({ kind: "trendline", id: t.id, x: clickX, y: clickY });
              return;
            }
          }
        }
        setSelectedDrawingId(null);
        setContextMenu(null);
        return;
      }

      if (toolRef.current === "hline") {
        addPriceLineRef.current(price, symbolRef.current);
        setToolRef.current("cursor");
        return;
      }

      if (toolRef.current === "measure") {
        if (!param.time) return;
        const time = Number(param.time);
        const current = measureRef.current;
        if (current.phase === "idle") {
          setMeasure({ phase: "placing", a: { time, price }, b: { time, price } });
        } else if (current.phase === "placing") {
          setMeasure({ phase: "done", a: current.a, b: { time, price } });
          setToolRef.current("cursor");
        } else {
          setMeasure({ phase: "placing", a: { time, price }, b: { time, price } });
        }
        return;
      }
      if (toolRef.current === "fibonacci" || toolRef.current === "fibext") {
        const sketch = fibSketchRef.current;
        if (sketch.phase === "idle") {
          setFibSketch({ phase: "placingB", a: price, b: price, c: null });
        } else if (sketch.phase === "placingB") {
          if (toolRef.current === "fibext") {
            setFibSketch({ phase: "placingC", a: sketch.a, b: price, c: price });
          } else {
            addFibDrawingRef.current({
              symbol: symbolRef.current,
              type: "retracement",
              highPrice: Math.max(sketch.a!, price),
              lowPrice: Math.min(sketch.a!, price),
            });
            setFibSketch(INITIAL_FIB);
            setToolRef.current("cursor");
          }
        } else if (sketch.phase === "placingC") {
          const a = sketch.a!, b = sketch.b!;
          addFibDrawingRef.current({
            symbol: symbolRef.current,
            type: "extension",
            pointA: a, pointB: b, pointC: price,
            highPrice: Math.max(a, b),
            lowPrice: Math.min(a, b),
          });
          setFibSketch(INITIAL_FIB);
          setToolRef.current("cursor");
        }
        return;
      }
      if (toolRef.current === "pricerange") {
        const sketch = priceRangeSketchRef.current;
        if (sketch.phase === "idle") {
          setPriceRangeSketch({ phase: "placing", a: price, b: price });
        } else {
          const high = Math.max(sketch.a!, price);
          const low = Math.min(sketch.a!, price);
          addPriceRangeRef.current({ symbol: symbolRef.current, highPrice: high, lowPrice: low });
          setPriceRangeSketch(INITIAL_PRICERANGE);
          setToolRef.current("cursor");
        }
        return;
      }
      if (toolRef.current === "trendline") {
        if (!param.time) return;
        const time = Number(param.time);
        setTrendSketch((prev) => ({ ...prev, points: [...prev.points, { time, price }] }));
        return;
      }
    });

    // Crosshair handler
    chart.subscribeCrosshairMove((param) => {
      if (settingCrosshairRef.current) {
        settingCrosshairRef.current = false;
      } else if (
        param.point &&
        param.time &&
        candleSeriesRef.current
      ) {
        const rawPrice2 = candleSeriesRef.current.coordinateToPrice(param.point.y);
        if (rawPrice2 !== null && isFinite(rawPrice2)) {
          const rawNum: number = Number(rawPrice2);
          let price: number = rawNum;
          if (magnetRef.current) {
            price = snapToOHLC(rawNum, Number(param.time), candlesRef.current,
              (p) => candleSeriesRef.current?.priceToCoordinate(p) ?? null);
            if (price !== rawNum && candleSeriesRef.current) {
              settingCrosshairRef.current = true;
              try { chart.setCrosshairPosition(price, param.time as UTCTimestamp, candleSeriesRef.current); } catch {}
            }
          }
          if (toolRef.current === "measure" && measureRef.current.phase === "placing") {
            const time = Number(param.time);
            setMeasure((prev) =>
              prev.phase === "placing" ? { ...prev, b: { time, price } } : prev,
            );
          }
          if (toolRef.current === "fibonacci" || toolRef.current === "fibext") {
            const ph = fibSketchRef.current.phase;
            if (ph === "placingB") setFibSketch((prev) => prev.phase === "placingB" ? { ...prev, b: price } : prev);
            else if (ph === "placingC") setFibSketch((prev) => prev.phase === "placingC" ? { ...prev, c: price } : prev);
          }
          if (toolRef.current === "pricerange" && priceRangeSketchRef.current.phase === "placing") {
            setPriceRangeSketch((prev) => prev.phase === "placing" ? { ...prev, b: price } : prev);
          }
          if (toolRef.current === "trendline" && trendSketchRef.current.points.length > 0 && param.time) {
            setTrendSketch((prev) => prev.points.length > 0 ? { ...prev, cursor: { time: Number(param.time), price } } : prev);
          }
        }
      }

      if (!param.time || !candleSeriesRef.current) {
        setHover(null);
        return;
      }
      const data = param.seriesData.get(candleSeriesRef.current);
      const vol = volumeSeriesRef.current
        ? param.seriesData.get(volumeSeriesRef.current)
        : null;
      if (data && "open" in data) {
        const o = data.open as number;
        const c = data.close as number;
        setHover({
          o,
          h: data.high as number,
          l: data.low as number,
          c,
          v: vol && "value" in vol ? (vol.value as number) : 0,
          time: Number(param.time),
          pct: o === 0 ? 0 : ((c - o) / o) * 100,
        });
      }
    });

    // Re-render measure overlay on pan / zoom so pixel coords stay in sync
    const tsRangeHandler = () => setRenderTick((t) => t + 1);
    chart.timeScale().subscribeVisibleTimeRangeChange(tsRangeHandler);
    const logicalRangeHandler = () => setRenderTick((t) => t + 1);
    chart.timeScale().subscribeVisibleLogicalRangeChange(logicalRangeHandler);

    // ResizeObserver — recompute pane offsets when chart container resizes
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => recomputePaneOffsets());
    });
    ro.observe(containerRef.current);
    recomputePaneOffsets();

    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(tsRangeHandler);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(logicalRangeHandler);
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      priceLinesMapRef.current.clear();
      ema20Ref.current = null;
      ema50Ref.current = null;
      ema200Ref.current = null;
      rsiRef.current = null;
      rsi30Ref.current = null;
      rsi70Ref.current = null;
      macdRef.current = null;
      macdSignalRef.current = null;
      macdHistRef.current = null;
    };
  }, []);

  // Manage volume — overlay at the bottom of the main pane
  useEffect(() => {
    if (!chartRef.current) return;
    if (indicators.volume && !volumeSeriesRef.current) {
      const v = chartRef.current.addSeries(
        HistogramSeries,
        {
          priceFormat: { type: "volume" },
          priceScaleId: "volume",
          color: TV_COLORS.textMuted,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        0,
      );
      v.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      volumeSeriesRef.current = v;
      const data = candlesRef.current.map((k) => ({
        time: k.time as UTCTimestamp,
        value: k.volume,
        color: k.close >= k.open ? `${TV_COLORS.green}66` : `${TV_COLORS.red}66`,
      }));
      v.setData(data);
    } else if (!indicators.volume && volumeSeriesRef.current && chartRef.current) {
      chartRef.current.removeSeries(volumeSeriesRef.current);
      volumeSeriesRef.current = null;
    }
    requestAnimationFrame(() => recomputePaneOffsets());
  }, [indicators.volume]);

  // RSI pane
  useEffect(() => {
    if (!chartRef.current) return;
    if (indicators.rsi && !rsiRef.current) {
      const paneIndex = 1;
      const r = chartRef.current.addSeries(
        LineSeries,
        {
          color: INDICATOR_COLORS.rsi,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      const r30 = chartRef.current.addSeries(
        LineSeries,
        {
          color: TV_COLORS.textMuted,
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      const r70 = chartRef.current.addSeries(
        LineSeries,
        {
          color: TV_COLORS.textMuted,
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      rsiRef.current = r;
      rsi30Ref.current = r30;
      rsi70Ref.current = r70;
      try {
        chartRef.current.panes()[1]?.setStretchFactor(1);
        chartRef.current.panes()[0]?.setStretchFactor(3);
      } catch {}
      updateRSI();
    } else if (!indicators.rsi && rsiRef.current && chartRef.current) {
      chartRef.current.removeSeries(rsiRef.current);
      if (rsi30Ref.current) chartRef.current.removeSeries(rsi30Ref.current);
      if (rsi70Ref.current) chartRef.current.removeSeries(rsi70Ref.current);
      rsiRef.current = null;
      rsi30Ref.current = null;
      rsi70Ref.current = null;
    }
    requestAnimationFrame(() => recomputePaneOffsets());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators.rsi]);

  // MACD pane
  useEffect(() => {
    if (!chartRef.current) return;
    if (indicators.macd && !macdRef.current) {
      const paneIndex = indicators.rsi ? 2 : 1;
      const m = chartRef.current.addSeries(
        LineSeries,
        {
          color: INDICATOR_COLORS.macd,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      const s = chartRef.current.addSeries(
        LineSeries,
        {
          color: TV_COLORS.yellow,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      const h = chartRef.current.addSeries(
        HistogramSeries,
        { priceLineVisible: false, lastValueVisible: false },
        paneIndex,
      );
      macdRef.current = m;
      macdSignalRef.current = s;
      macdHistRef.current = h;
      try {
        chartRef.current.panes()[paneIndex]?.setStretchFactor(1);
        chartRef.current.panes()[0]?.setStretchFactor(3);
      } catch {}
      updateMACD();
    } else if (!indicators.macd && macdRef.current && chartRef.current) {
      if (macdRef.current) chartRef.current.removeSeries(macdRef.current);
      if (macdSignalRef.current) chartRef.current.removeSeries(macdSignalRef.current);
      if (macdHistRef.current) chartRef.current.removeSeries(macdHistRef.current);
      macdRef.current = null;
      macdSignalRef.current = null;
      macdHistRef.current = null;
    }
    requestAnimationFrame(() => recomputePaneOffsets());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators.macd, indicators.rsi]);

  // Visibility — eye toggle (hidden state) + enabled state combined
  useEffect(() => {
    const v = (key: IndicatorKey) => indicators[key] && !hidden[key];
    ema20Ref.current?.applyOptions({ visible: v("ema20") });
    ema50Ref.current?.applyOptions({ visible: v("ema50") });
    if (ema200Ref.current) ema200Ref.current.applyOptions({ visible: v("ema200") });
    if (rsiRef.current) rsiRef.current.applyOptions({ visible: v("rsi") });
    if (rsi30Ref.current) rsi30Ref.current.applyOptions({ visible: v("rsi") });
    if (rsi70Ref.current) rsi70Ref.current.applyOptions({ visible: v("rsi") });
    if (macdRef.current) macdRef.current.applyOptions({ visible: v("macd") });
    if (macdSignalRef.current) macdSignalRef.current.applyOptions({ visible: v("macd") });
    if (macdHistRef.current) macdHistRef.current.applyOptions({ visible: v("macd") });
    if (volumeSeriesRef.current) volumeSeriesRef.current.applyOptions({ visible: v("volume") });
  }, [indicators, hidden]);

  // Recompute indicators when config changes (periods)
  useEffect(() => {
    updateEMAs();
  }, [config.ema20, config.ema50, config.ema200]);

  useEffect(() => {
    updateRSI();
  }, [config.rsi]);

  useEffect(() => {
    updateMACD();
  }, [config.macdFast, config.macdSlow, config.macdSignal]);

  // Sync price lines from store to the candle series
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;
    const map = priceLinesMapRef.current;
    const linesForThisSymbol = priceLines.filter((p) => p.symbol === symbol);
    const activeIds = new Set(linesForThisSymbol.map((p) => p.id));

    for (const [id, apiLine] of map.entries()) {
      if (!activeIds.has(id)) {
        try {
          series.removePriceLine(apiLine);
        } catch {}
        map.delete(id);
      }
    }
    for (const pl of linesForThisSymbol) {
      if (map.has(pl.id)) {
        try { map.get(pl.id)!.applyOptions({ color: pl.color ?? TV_COLORS.blue, title: pl.label ?? "" }); } catch {}
      } else {
        const apiLine = series.createPriceLine({
          price: pl.price,
          color: pl.color ?? TV_COLORS.blue,
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
          title: pl.label ?? "",
        });
        map.set(pl.id, apiLine);
      }
    }
  }, [priceLines, symbol]);

  // Cursor style when drawing tools are active + reset on tool change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.cursor =
        ["hline", "measure", "fibonacci", "fibext", "pricerange", "trendline"].includes(tool) ? "crosshair" : "";
    }
    if (tool !== "measure") setMeasure(INITIAL_MEASURE);
    if (tool !== "fibonacci" && tool !== "fibext") setFibSketch(INITIAL_FIB);
    if (tool !== "pricerange") setPriceRangeSketch(INITIAL_PRICERANGE);
    if (tool !== "trendline") setTrendSketch(INITIAL_TREND);
    if (tool !== "cursor") { setContextMenu(null); setSelectedDrawingId(null); }
  }, [tool]);

  // EMA 200 lazy creation/removal
  useEffect(() => {
    if (!chartRef.current) return;
    if (indicators.ema200 && !ema200Ref.current) {
      ema200Ref.current = chartRef.current.addSeries(LineSeries, {
        color: INDICATOR_COLORS.ema200, lineWidth: 2,
        priceLineVisible: false, lastValueVisible: false,
      }, 0);
      updateEMAs();
    } else if (!indicators.ema200 && ema200Ref.current && chartRef.current) {
      try { chartRef.current.removeSeries(ema200Ref.current); } catch {}
      ema200Ref.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators.ema200]);

  function updateEMAs() {
    const c = candlesRef.current;
    if (c.length === 0) return;
    const cfg = configRef.current;
    let last20: number | undefined;
    let last50: number | undefined;
    let last200: number | undefined;

    if (ema20Ref.current) {
      const data = ema(c, cfg.ema20);
      ema20Ref.current.setData(
        data.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
      );
      last20 = data.at(-1)?.value;
    }
    if (ema50Ref.current) {
      const data = ema(c, cfg.ema50);
      ema50Ref.current.setData(
        data.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
      );
      last50 = data.at(-1)?.value;
    }
    if (ema200Ref.current) {
      const data = ema(c, cfg.ema200);
      ema200Ref.current.setData(
        data.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
      );
      last200 = data.at(-1)?.value;
    }
    const lastVol = c.at(-1)?.volume;
    setLastValues((prev) => ({
      ...prev,
      ema20: last20,
      ema50: last50,
      ema200: last200,
      volume: lastVol,
    }));
  }

  function updateRSI() {
    const c = candlesRef.current;
    if (c.length === 0 || !rsiRef.current) return;
    const cfg = configRef.current;
    const data = rsi(c, cfg.rsi).map((p) => ({
      time: p.time as UTCTimestamp,
      value: p.value,
    }));
    rsiRef.current.setData(data);
    if (rsi30Ref.current && data.length > 0)
      rsi30Ref.current.setData([
        { time: data[0].time, value: 30 },
        { time: data[data.length - 1].time, value: 30 },
      ]);
    if (rsi70Ref.current && data.length > 0)
      rsi70Ref.current.setData([
        { time: data[0].time, value: 70 },
        { time: data[data.length - 1].time, value: 70 },
      ]);
    setLastValues((prev) => ({ ...prev, rsi: data.at(-1)?.value }));
  }

  function updateMACD() {
    const c = candlesRef.current;
    if (c.length === 0 || !macdRef.current) return;
    const cfg = configRef.current;
    const m = macd(c, cfg.macdFast, cfg.macdSlow, cfg.macdSignal);
    macdRef.current.setData(
      m.map((p) => ({ time: p.time as UTCTimestamp, value: p.macd })),
    );
    macdSignalRef.current?.setData(
      m.map((p) => ({ time: p.time as UTCTimestamp, value: p.signal })),
    );
    macdHistRef.current?.setData(
      m.map((p) => ({
        time: p.time as UTCTimestamp,
        value: p.histogram,
        color: p.histogram >= 0 ? `${TV_COLORS.green}80` : `${TV_COLORS.red}80`,
      })),
    );
    const last = m.at(-1);
    setLastValues((prev) => ({
      ...prev,
      macd: last?.macd,
      macdSignal: last?.signal,
      macdHist: last?.histogram,
    }));
  }

  // Load historical data + subscribe live
  useEffect(() => {
    let unsub: (() => void) | null = null;
    let cancelled = false;

    async function load() {
      try {
        const klines = await fetchKlines(symbol, timeframe, 1000);
        if (cancelled) return;
        candlesRef.current = klines;
        if (candleSeriesRef.current) {
          candleSeriesRef.current.setData(
            klines.map((k) => ({
              time: k.time as UTCTimestamp,
              open: k.open,
              high: k.high,
              low: k.low,
              close: k.close,
            })),
          );
        }
        if (volumeSeriesRef.current) {
          volumeSeriesRef.current.setData(
            klines.map((k) => ({
              time: k.time as UTCTimestamp,
              value: k.volume,
              color: k.close >= k.open ? `${TV_COLORS.green}66` : `${TV_COLORS.red}66`,
            })),
          );
        }
        updateEMAs();
        updateRSI();
        updateMACD();
        chartRef.current?.timeScale().fitContent();
        chartRef.current?.priceScale("right").applyOptions({ autoScale: true });
        requestAnimationFrame(() => recomputePaneOffsets());

        if (klines.length > 0) {
          const last = klines[klines.length - 1];
          const prev = klines[klines.length - 2] ?? last;
          setLastPrice({
            value: last.close,
            pct: prev.close === 0 ? 0 : ((last.close - prev.close) / prev.close) * 100,
          });
        }

        const ws = getBinanceWS();
        unsub = ws.subscribeKline({
          symbol,
          interval: timeframe,
          onCandle: (k) => {
            if (!candleSeriesRef.current) return;
            const arr = candlesRef.current;
            const lastCandle = arr[arr.length - 1];
            if (lastCandle && lastCandle.time === k.time) {
              arr[arr.length - 1] = k;
            } else if (!lastCandle || k.time > lastCandle.time) {
              arr.push(k);
              if (arr.length > 2000) arr.shift();
            } else {
              return;
            }
            candleSeriesRef.current.update({
              time: k.time as UTCTimestamp,
              open: k.open,
              high: k.high,
              low: k.low,
              close: k.close,
            });
            if (volumeSeriesRef.current) {
              volumeSeriesRef.current.update({
                time: k.time as UTCTimestamp,
                value: k.volume,
                color: k.close >= k.open ? `${TV_COLORS.green}66` : `${TV_COLORS.red}66`,
              });
            }
            updateEMAs();
            updateRSI();
            updateMACD();
            const prev = arr[arr.length - 2] ?? lastCandle;
            setLastPrice({
              value: k.close,
              pct: prev && prev.close !== 0 ? ((k.close - prev.close) / prev.close) * 100 : 0,
            });
          },
        });
      } catch (e) {
        console.error("Failed to load chart data:", e);
      }
    }

    load();

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [symbol, timeframe]);

  const greenOrRed = (n: number) =>
    n >= 0 ? "text-tv-green" : "text-tv-red";

  // Helpers for pill rendering
  const isShown = (key: IndicatorKey) =>
    indicators[key] && (key === "volume" || true); // always renderable if enabled
  void isShown;

  // Determine which pane each indicator lives in (based on current layout)
  const rsiPaneIdx = 1;
  const macdPaneIdx = indicators.rsi ? 2 : 1;

  let measureRender: React.ReactNode = null;
  if (
    measure.a &&
    measure.b &&
    chartRef.current &&
    candleSeriesRef.current
  ) {
    const ts = chartRef.current.timeScale();
    const aX = ts.timeToCoordinate(measure.a.time as UTCTimestamp);
    const bX = ts.timeToCoordinate(measure.b.time as UTCTimestamp);
    const aY = candleSeriesRef.current.priceToCoordinate(measure.a.price);
    const bY = candleSeriesRef.current.priceToCoordinate(measure.b.price);

    if (aX !== null && bX !== null && aY !== null && bY !== null) {
      const priceDiff = measure.b.price - measure.a.price;
      const pctChange =
        measure.a.price === 0 ? 0 : (priceDiff / measure.a.price) * 100;
      const isUp = priceDiff >= 0;
      const start = Math.min(measure.a.time, measure.b.time);
      const end = Math.max(measure.a.time, measure.b.time);
      const inRange = candlesRef.current.filter(
        (c) => c.time >= start && c.time <= end,
      );
      const bars = inRange.length;
      const volume = inRange.reduce((s, c) => s + c.volume, 0);
      const dur = durationLabel(measure.a.time, measure.b.time);

      measureRender = (
        <MeasureOverlay
          aX={aX}
          aY={aY}
          bX={bX}
          bY={bY}
          priceDiff={priceDiff}
          pctChange={pctChange}
          bars={bars}
          volume={volume}
          durationText={dur}
          isUp={isUp}
          isPreview={measure.phase === "placing"}
        />
      );
    }
  }
  // Fibonacci overlays
  const fibOverlays: React.ReactNode[] = [];
  const priceToCoord = (price: number) => candleSeriesRef.current?.priceToCoordinate(price) ?? null;
  const containerWidth = containerRef.current?.clientWidth ?? 800;

  if (fibSketch.phase === "placingB" && fibSketch.a !== null && fibSketch.b !== null) {
    const levels = computeFibLevels(
      Math.max(fibSketch.a, fibSketch.b), Math.min(fibSketch.a, fibSketch.b),
      "retracement", priceToCoord,
    );
    fibOverlays.push(
      <FibonacciOverlay key="sketch" levels={levels} chartWidth={containerWidth} isPreview formatPrice={formatPrice} />
    );
  } else if (fibSketch.phase === "placingC" && fibSketch.a !== null && fibSketch.b !== null && fibSketch.c !== null) {
    const levels = computeFibExtensionLevels(fibSketch.a, fibSketch.b, fibSketch.c, priceToCoord);
    fibOverlays.push(
      <FibonacciOverlay key="sketch" levels={levels} chartWidth={containerWidth} isPreview formatPrice={formatPrice} />
    );
  }

  for (const d of fibDrawings.filter((d) => d.symbol === symbol)) {
    const levels = d.type === "extension" && d.pointA != null && d.pointB != null && d.pointC != null
      ? computeFibExtensionLevels(d.pointA, d.pointB, d.pointC, priceToCoord, d.color)
      : computeFibLevels(d.highPrice, d.lowPrice, d.type, priceToCoord, d.color);
    fibOverlays.push(
      <FibonacciOverlay key={d.id} levels={levels} chartWidth={containerWidth} isSelected={selectedDrawingId === d.id} formatPrice={formatPrice} />
    );
  }

  // Price range overlays
  const priceRangeOverlays: React.ReactNode[] = [];
  if (priceRangeSketch.phase === "placing" && priceRangeSketch.a !== null && priceRangeSketch.b !== null) {
    priceRangeOverlays.push(
      <PriceRangeOverlay key="sketch" highPrice={Math.max(priceRangeSketch.a, priceRangeSketch.b)} lowPrice={Math.min(priceRangeSketch.a, priceRangeSketch.b)} priceToCoord={priceToCoord} chartWidth={containerWidth} isPreview formatPrice={formatPrice} />
    );
  }
  for (const r of priceRanges.filter((r) => r.symbol === symbol)) {
    priceRangeOverlays.push(
      <PriceRangeOverlay key={r.id} highPrice={r.highPrice} lowPrice={r.lowPrice} color={r.color} priceToCoord={priceToCoord} chartWidth={containerWidth} isSelected={selectedDrawingId === r.id} formatPrice={formatPrice} />
    );
  }

  // Trend line overlays
  const trendOverlays: React.ReactNode[] = [];
  {
    const tsApi = chartRef.current?.timeScale();
    const series = candleSeriesRef.current;
    const toPixel = (pt: TrendLinePoint): PixelPoint | null => {
      if (!tsApi || !series) return null;
      const y = series.priceToCoordinate(pt.price);
      if (y === null) return null;
      let x = tsApi.timeToCoordinate(pt.time as UTCTimestamp);
      if (x === null) {
        // Tiempo más allá de la última vela — extrapola con el intervalo promedio.
        const cs = candlesRef.current;
        if (cs.length < 2) return null;
        const lastIdx = cs.length - 1;
        const lastTime = Number(cs[lastIdx].time);
        const dt = (lastTime - Number(cs[0].time)) / lastIdx;
        if (dt === 0) return null;
        x = tsApi.logicalToCoordinate((lastIdx + (pt.time - lastTime) / dt) as Logical);
      }
      return x !== null ? { x, y } : null;
    };
    for (const t of trendLines.filter((t) => t.symbol === symbol)) {
      const px = t.points.map(toPixel).filter((p): p is PixelPoint => p !== null);
      if (px.length >= 2) {
        trendOverlays.push(
          <TrendLineOverlay key={t.id} points={px} color={t.color} isSelected={selectedDrawingId === t.id} extendRight chartWidth={containerWidth} />
        );
      }
    }
    if (trendSketch.points.length > 0) {
      const sketchPts = [...trendSketch.points, ...(trendSketch.cursor ? [trendSketch.cursor] : [])];
      const px = sketchPts.map(toPixel).filter((p): p is PixelPoint => p !== null);
      if (px.length >= 1) {
        trendOverlays.push(<TrendLineOverlay key="trend-sketch" points={px} isPreview />);
      }
    }
  }

  const finishTrendLine = () => {
    if (trendSketch.points.length >= 2) {
      addTrendLine({ symbol, points: trendSketch.points });
    }
    setTrendSketch(INITIAL_TREND);
    setTool("cursor");
  };
  const cancelTrendLine = () => {
    setTrendSketch(INITIAL_TREND);
    setTool("cursor");
  };

  void renderTick;

  const activeIndicators = (Object.keys(indicators) as (keyof typeof indicators)[]).filter((k) => indicators[k]);
  const recentCandles = candlesRef.current.slice(-100).map((c) =>
    `${new Date((c.time as number) * 1000).toISOString().slice(0, 16).replace("T", " ")}: O=${c.open.toFixed(4)} H=${c.high.toFixed(4)} L=${c.low.toFixed(4)} C=${c.close.toFixed(4)}`
  ).join("\n");

  return (
    <div className="relative h-full w-full overflow-hidden" onClick={() => { if (contextMenu) { setContextMenu(null); setSelectedDrawingId(null); } }}>
      <div ref={containerRef} className="h-full w-full" />
      {measureRender}
      {fibOverlays}
      {priceRangeOverlays}
      {trendOverlays}

      {tool === "trendline" && (
        <div className="pointer-events-auto absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-tv-border bg-tv-panel px-3 py-1.5 shadow-lg">
          <span className="text-[11px] text-tv-text-muted">
            Línea de tendencia · {trendSketch.points.length} punto{trendSketch.points.length === 1 ? "" : "s"}
          </span>
          <button
            onClick={finishTrendLine}
            disabled={trendSketch.points.length < 2}
            className="rounded bg-tv-blue px-2 py-0.5 text-[11px] font-semibold text-white transition-colors hover:bg-tv-blue/80 disabled:opacity-40"
          >
            Finalizar
          </button>
          <button
            onClick={cancelTrendLine}
            className="rounded px-1.5 py-0.5 text-[11px] text-tv-text-muted hover:text-tv-red"
          >
            Cancelar
          </button>
        </div>
      )}

      {contextMenu && contextMenu.kind === "fib" && (() => {
        const d = fibDrawings.find((x) => x.id === contextMenu.id);
        if (!d) return null;
        return <DrawingContextMenu kind="fib" x={contextMenu.x} y={contextMenu.y} color={d.color} fibType={d.type} onFibTypeChange={(t) => updateFibDrawing(d.id, { type: t })} onColorChange={(c) => updateFibDrawing(d.id, { color: c })} onDelete={() => removeFibDrawing(d.id)} onClose={() => { setContextMenu(null); setSelectedDrawingId(null); }} />;
      })()}
      {contextMenu && contextMenu.kind === "hline" && (() => {
        const pl = priceLines.find((x) => x.id === contextMenu.id);
        if (!pl) return null;
        return <DrawingContextMenu kind="hline" x={contextMenu.x} y={contextMenu.y} color={pl.color} onColorChange={(c) => updatePriceLineColor(pl.id, c)} onDelete={() => removePriceLine(pl.id)} onClose={() => { setContextMenu(null); setSelectedDrawingId(null); }} />;
      })()}
      {contextMenu && contextMenu.kind === "pricerange" && (() => {
        const r = priceRanges.find((x) => x.id === contextMenu.id);
        if (!r) return null;
        return <DrawingContextMenu kind="pricerange" x={contextMenu.x} y={contextMenu.y} color={r.color} onColorChange={(c) => updatePriceRangeColor(r.id, c)} onDelete={() => removePriceRange(r.id)} onClose={() => { setContextMenu(null); setSelectedDrawingId(null); }} />;
      })()}
      {contextMenu && contextMenu.kind === "trendline" && (() => {
        const t = trendLines.find((x) => x.id === contextMenu.id);
        if (!t) return null;
        return <DrawingContextMenu kind="trendline" x={contextMenu.x} y={contextMenu.y} color={t.color} onColorChange={(c) => updateTrendLineColor(t.id, c)} onDelete={() => removeTrendLine(t.id)} onClose={() => { setContextMenu(null); setSelectedDrawingId(null); }} />;
      })()}

      {/* Top-left of main pane: symbol info + OHLC + Volume pill + EMA pills */}
      <div
        style={{ top: (paneOffsets[0]?.top ?? 0) + 12, left: 12 }}
        className="pointer-events-none absolute z-10 flex flex-col gap-1 text-xs tabular-nums"
      >
        {/* Row 1: symbol info + OHLC stats inline on hover (fixed height, never wraps) */}
        <div className="flex h-5 flex-nowrap items-center gap-x-3 overflow-hidden whitespace-nowrap">
          <div className="flex shrink-0 items-center gap-2 text-[13px] font-semibold">
            <span className="text-tv-text">{symbol}</span>
            <span className="text-tv-text-muted">·</span>
            <span className="uppercase text-tv-text-muted">{timeframe}</span>
            <span className="text-tv-text-muted">·</span>
            <span className="text-tv-text-muted">Binance</span>
          </div>
          {hover && (
            <div className="flex items-center gap-x-3 text-[11px]">
              <span className="text-tv-text-muted">
                O <span className={greenOrRed(hover.c - hover.o)}>{formatPrice(hover.o)}</span>
              </span>
              <span className="text-tv-text-muted">
                H <span className={greenOrRed(hover.c - hover.o)}>{formatPrice(hover.h)}</span>
              </span>
              <span className="text-tv-text-muted">
                L <span className={greenOrRed(hover.c - hover.o)}>{formatPrice(hover.l)}</span>
              </span>
              <span className="text-tv-text-muted">
                C <span className={greenOrRed(hover.c - hover.o)}>{formatPrice(hover.c)}</span>
              </span>
              <span className={greenOrRed(hover.pct)}>
                {hover.pct >= 0 ? "+" : ""}
                {hover.pct.toFixed(2)}%
              </span>
              <span className="text-tv-text-muted">
                Vol <span className="text-tv-text">{formatVolume(hover.v)}</span>
              </span>
            </div>
          )}
        </div>

        {/* Row 2: big live price (always present — reserves space even while loading) */}
        <div className="flex h-7 items-center gap-2">
          {lastPrice ? (
            <>
              <span className={`text-lg font-semibold tabular-nums ${greenOrRed(lastPrice.pct)}`}>
                {formatPrice(lastPrice.value)}
              </span>
              <span className={`text-xs ${greenOrRed(lastPrice.pct)}`}>
                {lastPrice.pct >= 0 ? "+" : ""}
                {lastPrice.pct.toFixed(2)}%
              </span>
            </>
          ) : (
            <span className="text-xs text-tv-text-muted">Cargando…</span>
          )}
        </div>

        {/* Indicator pills for the main pane (fixed position below price) */}
        <div className="mt-1 flex flex-col items-start gap-1">
          {indicators.ema20 && (
            <IndicatorPill
              name={`EMA ${config.ema20}`}
              value={lastValues.ema20 !== undefined ? formatPrice(lastValues.ema20) : undefined}
              color={INDICATOR_COLORS.ema20}
              hidden={hidden.ema20}
              onToggleHide={() => toggleHidden("ema20")}
              onSettings={() => setSettingsTarget("ema20")}
              onRemove={() => removeIndicator("ema20")}
            />
          )}
          {indicators.ema50 && (
            <IndicatorPill
              name={`EMA ${config.ema50}`}
              value={lastValues.ema50 !== undefined ? formatPrice(lastValues.ema50) : undefined}
              color={INDICATOR_COLORS.ema50}
              hidden={hidden.ema50}
              onToggleHide={() => toggleHidden("ema50")}
              onSettings={() => setSettingsTarget("ema50")}
              onRemove={() => removeIndicator("ema50")}
            />
          )}
          {indicators.ema200 && (
            <IndicatorPill
              name={`EMA ${config.ema200}`}
              value={lastValues.ema200 !== undefined ? formatPrice(lastValues.ema200) : undefined}
              color={INDICATOR_COLORS.ema200}
              hidden={hidden.ema200}
              onToggleHide={() => toggleHidden("ema200")}
              onSettings={() => setSettingsTarget("ema200")}
              onRemove={() => removeIndicator("ema200")}
            />
          )}
          {indicators.volume && (
            <IndicatorPill
              name="Vol"
              value={lastValues.volume !== undefined ? formatVolume(lastValues.volume) : undefined}
              color={INDICATOR_COLORS.volume}
              hidden={hidden.volume}
              onToggleHide={() => toggleHidden("volume")}
              onSettings={() => setSettingsTarget("volume")}
              onRemove={() => removeIndicator("volume")}
            />
          )}
        </div>
      </div>

      {/* RSI pane label */}
      {indicators.rsi && paneOffsets[rsiPaneIdx] && (
        <div
          style={{ top: paneOffsets[rsiPaneIdx].top + 6, left: 12 }}
          className="pointer-events-none absolute z-10"
        >
          <IndicatorPill
            name={`RSI ${config.rsi}`}
            value={lastValues.rsi !== undefined ? lastValues.rsi.toFixed(2) : undefined}
            color={INDICATOR_COLORS.rsi}
            hidden={hidden.rsi}
            onToggleHide={() => toggleHidden("rsi")}
            onSettings={() => setSettingsTarget("rsi")}
            onRemove={() => removeIndicator("rsi")}
          />
        </div>
      )}

      {/* MACD pane label */}
      {indicators.macd && paneOffsets[macdPaneIdx] && (
        <div
          style={{ top: paneOffsets[macdPaneIdx].top + 6, left: 12 }}
          className="pointer-events-none absolute z-10"
        >
          <IndicatorPill
            name={`MACD ${config.macdFast}, ${config.macdSlow}, ${config.macdSignal}`}
            value={
              lastValues.macd !== undefined
                ? `${lastValues.macd.toFixed(2)} / ${(lastValues.macdSignal ?? 0).toFixed(2)}`
                : undefined
            }
            color={INDICATOR_COLORS.macd}
            hidden={hidden.macd}
            onToggleHide={() => toggleHidden("macd")}
            onSettings={() => setSettingsTarget("macd")}
            onRemove={() => removeIndicator("macd")}
          />
        </div>
      )}

      <AlertsPanel symbol={symbol.replace("USDT", "")} market="crypto" currentPrice={lastPrice?.value ?? 0} />
      <AiPanel
        context={{
          symbol,
          price: lastPrice ? formatPrice(lastPrice.value) : "—",
          pct: lastPrice ? lastPrice.pct.toFixed(2) : "0",
          market: "crypto",
          indicators: activeIndicators,
          candles: recentCandles || undefined,
        }}
        onAction={(action: ChartAction) => {
          if (action.type === "add_hline") {
            addPriceLine(action.price, symbol, action.color, action.label);
          } else if (action.type === "add_price_range") {
            addPriceRange({ symbol, highPrice: action.high, lowPrice: action.low, color: action.color });
          } else if (action.type === "add_fibonacci") {
            const a = Number(action.pointA), b = Number(action.pointB), c = Number(action.pointC);
            if (action.kind === "extension" && [a, b, c].every(isFinite)) {
              addFibDrawing({
                symbol, type: "extension",
                pointA: a, pointB: b, pointC: c,
                highPrice: Math.max(a, b), lowPrice: Math.min(a, b),
                color: action.color,
              });
            } else {
              const high = Math.max(Number(action.high), Number(action.low));
              const low = Math.min(Number(action.high), Number(action.low));
              if (isFinite(high) && isFinite(low)) {
                addFibDrawing({ symbol, type: action.kind ?? "retracement", highPrice: high, lowPrice: low, color: action.color });
              }
            }
          } else if (action.type === "add_trendline") {
            const points = aiPointsToTrend(action.points, candlesRef.current);
            if (points.length >= 2) addTrendLine({ symbol, points, color: action.color });
          } else if (action.type === "project_path") {
            const cs = candlesRef.current;
            const wps = Array.isArray(action.points) ? action.points : [];
            if (cs.length >= 2 && wps.length >= 1) {
              const lastIdx = cs.length - 1;
              const lastTime = Number(cs[lastIdx].time);
              const avg = (lastTime - Number(cs[0].time)) / lastIdx;
              const pts: TrendLinePoint[] = [{ time: lastTime, price: cs[lastIdx].close }];
              let maxBars = 0;
              for (const wp of wps) {
                const price = Number(wp.price);
                const weeks = Math.min(Math.max(Number(wp.weeks) || 1, 0.25), 16);
                const barsAhead = Math.max(1, Math.round(weeks * 5));
                if (!isFinite(price) || price <= 0) continue;
                pts.push({ time: Math.round(lastTime + barsAhead * avg), price });
                maxBars = Math.max(maxBars, barsAhead);
              }
              if (pts.length >= 2) {
                pts.sort((a, b) => a.time - b.time);
                addTrendLine({ symbol, points: pts, color: action.color });
                const ts = chartRef.current?.timeScale();
                if (ts) {
                  try {
                    ts.applyOptions({ rightOffset: maxBars + 12 });
                    ts.setVisibleLogicalRange({
                      from: Math.max(0, lastIdx - 70),
                      to: lastIdx + maxBars + 8,
                    });
                  } catch { /* chart no listo */ }
                }
              }
            }
          } else if (action.type === "enable_indicator") {
            if (!indicators[action.name]) toggleIndicator(action.name);
          } else if (action.type === "disable_indicator") {
            if (indicators[action.name]) toggleIndicator(action.name);
          } else if (action.type === "clear_drawings") {
            const kind = action.kind ?? "all";
            if (kind === "hlines" || kind === "all") clearPriceLines(symbol);
            if (kind === "ranges" || kind === "all") clearPriceRanges(symbol);
            if (kind === "fibs" || kind === "all") clearFibDrawings(symbol);
            if (kind === "trends" || kind === "all") clearTrendLines(symbol);
          } else if (action.type === "set_symbol") {
            const s = action.symbol.toUpperCase();
            setSymbolStore(s.endsWith("USDT") ? s : s + "USDT");
          } else if (action.type === "set_timeframe") {
            const tf = action.timeframe.toLowerCase();
            const valid = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"];
            if (valid.includes(tf)) setTimeframeStore(tf as Timeframe);
            else if (tf === "1mo" || tf === "1month") setTimeframeStore("1M" as Timeframe);
          }
        }}
      />
    </div>
  );
}
