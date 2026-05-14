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
} from "lightweight-charts";
import { useIolStore } from "@/lib/store/iol-store";
import { useIolHistorical } from "@/hooks/useIolHistorical";
import { useIolQuote } from "@/hooks/useIolQuote";
import { ema, rsi, macd } from "@/lib/indicators";
import type { IolCandle, IolDateRange } from "@/lib/iol/rest";
import {
  INDICATOR_COLORS,
  useChartStore,
  type IndicatorKey,
} from "@/lib/store/chart-store";
import { formatARS, formatPct } from "@/lib/format";
import { IndicatorPill } from "./IndicatorPill";
import { MeasureOverlay } from "./MeasureOverlay";
import { FibonacciOverlay, computeFibLevels, RETRACEMENT_LEVELS, EXTENSION_LEVELS } from "./FibonacciOverlay";
import { DrawingContextMenu } from "./DrawingContextMenu";
import { AiPanel } from "@/components/ai/AiPanel";
import { AlertsPanel } from "@/components/chart/AlertsPanel";
import type { Candle } from "@/lib/binance/types";

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

const DATE_RANGES: IolDateRange[] = ["1M", "3M", "6M", "1A", "5A"];

function durationLabel(aTime: number, bTime: number): string {
  const diff = Math.abs(bTime - aTime);
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  return `${Math.floor((diff % 3600) / 60)}m`;
}

function snapToOHLC(
  rawPrice: number,
  time: number,
  candles: IolCandle[],
  priceToCoord: (p: number) => number | null,
  thresholdPx = 20,
): number {
  const c = candles.find((x) => Number(x.time) === time)
    ?? candles.reduce<IolCandle | null>((b, x) => !b || Math.abs(Number(x.time) - time) < Math.abs(Number(b.time) - time) ? x : b, null);
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

function toCandles(arr: IolCandle[]): Candle[] {
  return arr as unknown as Candle[];
}

interface MeasurePoint { time: number; price: number; }
interface MeasureState { phase: "idle" | "placing" | "done"; a: MeasurePoint | null; b: MeasurePoint | null; }
const INITIAL_MEASURE: MeasureState = { phase: "idle", a: null, b: null };

interface FibSketch { phase: "idle" | "placing"; a: number | null; b: number | null; }
const INITIAL_FIB: FibSketch = { phase: "idle", a: null, b: null };

interface HoverInfo { o: number; h: number; l: number; c: number; v: number; time: number; pct: number; }
interface LastValues { ema20?: number; ema50?: number; ema200?: number; rsi?: number; macd?: number; macdSignal?: number; macdHist?: number; volume?: number; }
interface PaneOffset { top: number; height: number; }

function formatVolume(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toFixed(0);
}

export function IolPriceChart() {
  const selectedSymbol = useIolStore((s) => s.selectedSymbol);
  const dateRange = useIolStore((s) => s.dateRange);
  const setDateRange = useIolStore((s) => s.setDateRange);
  const iolTimeframe = useIolStore((s) => s.iolTimeframe);

  const indicators = useChartStore((s) => s.indicators);
  const hidden = useChartStore((s) => s.hidden);
  const config = useChartStore((s) => s.config);
  const tool = useChartStore((s) => s.tool);
  const setTool = useChartStore((s) => s.setTool);
  const priceLines = useChartStore((s) => s.priceLines);
  const fibDrawings = useChartStore((s) => s.fibDrawings);
  const addPriceLine = useChartStore((s) => s.addPriceLine);
  const addFibDrawing = useChartStore((s) => s.addFibDrawing);
  const removeFibDrawing = useChartStore((s) => s.removeFibDrawing);
  const updateFibDrawing = useChartStore((s) => s.updateFibDrawing);
  const removePriceLine = useChartStore((s) => s.removePriceLine);
  const updatePriceLineColor = useChartStore((s) => s.updatePriceLineColor);
  const removeIndicator = useChartStore((s) => s.removeIndicator);
  const toggleHidden = useChartStore((s) => s.toggleHidden);
  const setSettingsTarget = useChartStore((s) => s.setSettingsTarget);

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
  const candlesRef = useRef<IolCandle[]>([]);
  const priceLinesMapRef = useRef<Map<string, IPriceLine>>(new Map());
  const dataLoadedRef = useRef(false);

  const magnet = useChartStore((s) => s.magnet);
  const magnetRef = useRef(magnet);
  magnetRef.current = magnet;
  const settingCrosshairRef = useRef(false);

  const toolRef = useRef(tool);
  toolRef.current = tool;
  const addPriceLineRef = useRef(addPriceLine);
  addPriceLineRef.current = addPriceLine;
  const addFibDrawingRef = useRef(addFibDrawing);
  addFibDrawingRef.current = addFibDrawing;
  const selectedSymbolRef = useRef(selectedSymbol);
  selectedSymbolRef.current = selectedSymbol;
  const configRef = useRef(config);
  configRef.current = config;
  const setToolRef = useRef(setTool);
  setToolRef.current = setTool;
  const fibDrawingsRef = useRef(fibDrawings);
  fibDrawingsRef.current = fibDrawings;
  const priceLinesRef = useRef(priceLines);
  priceLinesRef.current = priceLines;

  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [lastPrice, setLastPrice] = useState<{ value: number; pct: number } | null>(null);
  const [lastValues, setLastValues] = useState<LastValues>({});
  const [paneOffsets, setPaneOffsets] = useState<PaneOffset[]>([]);
  const [measure, setMeasure] = useState<MeasureState>(INITIAL_MEASURE);
  const [fibSketch, setFibSketch] = useState<FibSketch>(INITIAL_FIB);
  const [renderTick, setRenderTick] = useState(0);
  const [contextMenu, setContextMenu] = useState<{
    kind: "fib" | "hline";
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const measureRef = useRef(measure);
  measureRef.current = measure;
  const fibSketchRef = useRef(fibSketch);
  fibSketchRef.current = fibSketch;

  const { candles, loading, error } = useIolHistorical(selectedSymbol, iolTimeframe);
  const { quote } = useIolQuote(selectedSymbol);

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
      grid: { vertLines: { color: TV_COLORS.grid }, horzLines: { color: TV_COLORS.grid } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: TV_COLORS.textMuted, width: 1, style: 3, labelBackgroundColor: TV_COLORS.panel },
        horzLine: { color: TV_COLORS.textMuted, width: 1, style: 3, labelBackgroundColor: TV_COLORS.panel },
      },
      rightPriceScale: { borderColor: TV_COLORS.border, textColor: TV_COLORS.textMuted },
      timeScale: { borderColor: TV_COLORS.border, timeVisible: true, secondsVisible: false, rightOffset: 12, barSpacing: 8 },
      autoSize: true,
    });

    candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: TV_COLORS.green, downColor: TV_COLORS.red,
      borderUpColor: TV_COLORS.green, borderDownColor: TV_COLORS.red,
      wickUpColor: TV_COLORS.green, wickDownColor: TV_COLORS.red,
      priceLineColor: TV_COLORS.textMuted, priceLineStyle: 2,
    });
    ema20Ref.current = chart.addSeries(LineSeries, { color: INDICATOR_COLORS.ema20, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    ema50Ref.current = chart.addSeries(LineSeries, { color: INDICATOR_COLORS.ema50, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    ema200Ref.current = chart.addSeries(LineSeries, { color: INDICATOR_COLORS.ema200, lineWidth: 2, priceLineVisible: false, lastValueVisible: false });

    chartRef.current = chart;

    chart.subscribeClick((param) => {
      if (!param.point || !candleSeriesRef.current) return;
      const rawPrice = candleSeriesRef.current.coordinateToPrice(param.point.y);
      if (rawPrice === null || !isFinite(rawPrice)) return;
      let price: number = Number(rawPrice);
      if (magnetRef.current && param.time) {
        price = snapToOHLC(price, Number(param.time), candlesRef.current,
          (p) => candleSeriesRef.current?.priceToCoordinate(p) ?? null);
      }
      const currentTool = toolRef.current;
      const clickY = param.point.y;
      const clickX = param.point.x;

      if (currentTool === "cursor") {
        const symbol = selectedSymbolRef.current;
        const series = candleSeriesRef.current;
        // Check price lines
        for (const pl of priceLinesRef.current.filter((p) => p.symbol === symbol)) {
          const lineY = series.priceToCoordinate(pl.price);
          if (lineY !== null && Math.abs(lineY - clickY) < 8) {
            setSelectedDrawingId(pl.id);
            setContextMenu({ kind: "hline", id: pl.id, x: clickX, y: lineY });
            return;
          }
        }
        // Check fib drawings
        for (const d of fibDrawingsRef.current.filter((f) => f.symbol === symbol)) {
          const levels = d.type === "extension" ? EXTENSION_LEVELS : RETRACEMENT_LEVELS;
          const range = d.highPrice - d.lowPrice;
          for (const l of levels) {
            const p = d.highPrice - range * l.ratio;
            const lineY = series.priceToCoordinate(p);
            if (lineY !== null && Math.abs(lineY - clickY) < 8) {
              setSelectedDrawingId(d.id);
              setContextMenu({ kind: "fib", id: d.id, x: clickX, y: lineY });
              return;
            }
          }
        }
        setSelectedDrawingId(null);
        setContextMenu(null);
        return;
      }

      if (currentTool === "hline") {
        addPriceLineRef.current(price, selectedSymbolRef.current);
        setToolRef.current("cursor");
        return;
      }
      if (currentTool === "measure") {
        if (!param.time) return;
        const time = Number(param.time);
        const cur = measureRef.current;
        if (cur.phase === "idle" || cur.phase === "done") {
          setMeasure({ phase: "placing", a: { time, price }, b: { time, price } });
        } else {
          setMeasure({ phase: "done", a: cur.a, b: { time, price } });
          setToolRef.current("cursor");
        }
        return;
      }
      if (currentTool === "fibonacci" || currentTool === "fibext") {
        const sketch = fibSketchRef.current;
        if (sketch.phase === "idle") {
          setFibSketch({ phase: "placing", a: price, b: price });
        } else {
          const high = Math.max(sketch.a!, price);
          const low = Math.min(sketch.a!, price);
          addFibDrawingRef.current({
            symbol: selectedSymbolRef.current,
            type: currentTool === "fibext" ? "extension" : "retracement",
            highPrice: high,
            lowPrice: low,
          });
          setFibSketch(INITIAL_FIB);
          setToolRef.current("cursor");
        }
      }
    });

    chart.subscribeCrosshairMove((param) => {
      if (settingCrosshairRef.current) {
        settingCrosshairRef.current = false;
      } else if (param.point && param.time && candleSeriesRef.current) {
        const rawP = candleSeriesRef.current.coordinateToPrice(param.point.y);
        if (rawP !== null && isFinite(rawP)) {
          const rawNum: number = Number(rawP);
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
            setMeasure((prev) => prev.phase === "placing" ? { ...prev, b: { time: Number(param.time), price } } : prev);
          }
          if ((toolRef.current === "fibonacci" || toolRef.current === "fibext") && fibSketchRef.current.phase === "placing") {
            setFibSketch((prev) => prev.phase === "placing" ? { ...prev, b: price } : prev);
          }
        }
      }
      if (!param.time || !candleSeriesRef.current) { setHover(null); return; }
      const data = param.seriesData.get(candleSeriesRef.current);
      const vol = volumeSeriesRef.current ? param.seriesData.get(volumeSeriesRef.current) : null;
      if (data && "open" in data) {
        const o = data.open as number;
        const c = data.close as number;
        setHover({ o, h: data.high as number, l: data.low as number, c, v: vol && "value" in vol ? (vol.value as number) : 0, time: Number(param.time), pct: o === 0 ? 0 : ((c - o) / o) * 100 });
      }
    });

    const tsRangeHandler = () => setRenderTick((t) => t + 1);
    const lrHandler = () => setRenderTick((t) => t + 1);
    chart.timeScale().subscribeVisibleTimeRangeChange(tsRangeHandler);
    chart.timeScale().subscribeVisibleLogicalRangeChange(lrHandler);

    const ro = new ResizeObserver(() => requestAnimationFrame(() => recomputePaneOffsets()));
    ro.observe(containerRef.current);
    recomputePaneOffsets();

    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(tsRangeHandler);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(lrHandler);
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      ema20Ref.current = null; ema50Ref.current = null; ema200Ref.current = null;
      rsiRef.current = null; rsi30Ref.current = null; rsi70Ref.current = null;
      macdRef.current = null; macdSignalRef.current = null; macdHistRef.current = null;
      priceLinesMapRef.current.clear();
    };
  }, []);

  // Load historical candles
  useEffect(() => {
    if (!candleSeriesRef.current || candles.length === 0) return;
    candlesRef.current = candles;
    candleSeriesRef.current.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close })));
    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.volume, color: c.close >= c.open ? `${TV_COLORS.green}66` : `${TV_COLORS.red}66` })));
    }
    updateEMAs();
    updateRSI();
    updateMACD();
    chartRef.current?.timeScale().fitContent();
    dataLoadedRef.current = true;
    requestAnimationFrame(() => recomputePaneOffsets());
    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2] ?? last;
    if (last) setLastPrice({ value: last.close, pct: prev.close === 0 ? 0 : ((last.close - prev.close) / prev.close) * 100 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles]);

  // Update last candle with live quote
  useEffect(() => {
    if (!quote || !candleSeriesRef.current || !dataLoadedRef.current) return;
    const last = candlesRef.current[candlesRef.current.length - 1];
    if (!last) return;
    candleSeriesRef.current.update({
      time: last.time as UTCTimestamp,
      open: last.open,
      high: Math.max(last.high, quote.ultimoPrecio),
      low: Math.min(last.low, quote.ultimoPrecio),
      close: quote.ultimoPrecio,
    });
    setLastPrice({ value: quote.ultimoPrecio, pct: quote.variacion });
  }, [quote]);

  // Volume indicator
  useEffect(() => {
    if (!chartRef.current) return;
    if (indicators.volume && !volumeSeriesRef.current) {
      const v = chartRef.current.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "volume", color: TV_COLORS.textMuted, priceLineVisible: false, lastValueVisible: false }, 0);
      v.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      volumeSeriesRef.current = v;
      const data = candlesRef.current.map((c) => ({ time: c.time as UTCTimestamp, value: c.volume, color: c.close >= c.open ? `${TV_COLORS.green}66` : `${TV_COLORS.red}66` }));
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
      rsiRef.current = chartRef.current.addSeries(LineSeries, { color: INDICATOR_COLORS.rsi, lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, paneIndex);
      rsi30Ref.current = chartRef.current.addSeries(LineSeries, { color: TV_COLORS.textMuted, lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false }, paneIndex);
      rsi70Ref.current = chartRef.current.addSeries(LineSeries, { color: TV_COLORS.textMuted, lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false }, paneIndex);
      try { chartRef.current.panes()[1]?.setStretchFactor(1); chartRef.current.panes()[0]?.setStretchFactor(3); } catch {}
      updateRSI();
    } else if (!indicators.rsi && rsiRef.current && chartRef.current) {
      chartRef.current.removeSeries(rsiRef.current);
      if (rsi30Ref.current) chartRef.current.removeSeries(rsi30Ref.current);
      if (rsi70Ref.current) chartRef.current.removeSeries(rsi70Ref.current);
      rsiRef.current = null; rsi30Ref.current = null; rsi70Ref.current = null;
    }
    requestAnimationFrame(() => recomputePaneOffsets());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators.rsi]);

  // MACD pane
  useEffect(() => {
    if (!chartRef.current) return;
    if (indicators.macd && !macdRef.current) {
      const paneIndex = indicators.rsi ? 2 : 1;
      macdRef.current = chartRef.current.addSeries(LineSeries, { color: INDICATOR_COLORS.macd, lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, paneIndex);
      macdSignalRef.current = chartRef.current.addSeries(LineSeries, { color: TV_COLORS.yellow, lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, paneIndex);
      macdHistRef.current = chartRef.current.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, paneIndex);
      try { chartRef.current.panes()[paneIndex]?.setStretchFactor(1); chartRef.current.panes()[0]?.setStretchFactor(3); } catch {}
      updateMACD();
    } else if (!indicators.macd && macdRef.current && chartRef.current) {
      if (macdRef.current) chartRef.current.removeSeries(macdRef.current);
      if (macdSignalRef.current) chartRef.current.removeSeries(macdSignalRef.current);
      if (macdHistRef.current) chartRef.current.removeSeries(macdHistRef.current);
      macdRef.current = null; macdSignalRef.current = null; macdHistRef.current = null;
    }
    requestAnimationFrame(() => recomputePaneOffsets());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators.macd, indicators.rsi]);

  // Visibility (eye toggle)
  useEffect(() => {
    const v = (key: IndicatorKey) => indicators[key] && !hidden[key];
    ema20Ref.current?.applyOptions({ visible: v("ema20") });
    ema50Ref.current?.applyOptions({ visible: v("ema50") });
    ema200Ref.current?.applyOptions({ visible: v("ema200") });
    if (rsiRef.current) rsiRef.current.applyOptions({ visible: v("rsi") });
    if (rsi30Ref.current) rsi30Ref.current.applyOptions({ visible: v("rsi") });
    if (rsi70Ref.current) rsi70Ref.current.applyOptions({ visible: v("rsi") });
    if (macdRef.current) macdRef.current.applyOptions({ visible: v("macd") });
    if (macdSignalRef.current) macdSignalRef.current.applyOptions({ visible: v("macd") });
    if (macdHistRef.current) macdHistRef.current.applyOptions({ visible: v("macd") });
    if (volumeSeriesRef.current) volumeSeriesRef.current.applyOptions({ visible: v("volume") });
  }, [indicators, hidden]);

  useEffect(() => { updateEMAs(); }, [config.ema20, config.ema50, config.ema200]);
  useEffect(() => { updateRSI(); }, [config.rsi]);
  useEffect(() => { updateMACD(); }, [config.macdFast, config.macdSlow, config.macdSignal]);

  // Sync price lines
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;
    const map = priceLinesMapRef.current;
    const linesForSymbol = priceLines.filter((p) => p.symbol === selectedSymbol);
    const activeIds = new Set(linesForSymbol.map((p) => p.id));
    for (const [id, apiLine] of map.entries()) {
      if (!activeIds.has(id)) { try { series.removePriceLine(apiLine); } catch {} map.delete(id); }
    }
    for (const pl of linesForSymbol) {
      if (map.has(pl.id)) {
        // Update color if changed
        try { map.get(pl.id)!.applyOptions({ color: pl.color ?? TV_COLORS.blue }); } catch {}
      } else {
        const apiLine = series.createPriceLine({ price: pl.price, color: pl.color ?? TV_COLORS.blue, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "" });
        map.set(pl.id, apiLine);
      }
    }
  }, [priceLines, selectedSymbol]);

  // Cursor + reset on tool change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.cursor = ["hline", "measure", "fibonacci", "fibext"].includes(tool) ? "crosshair" : "";
    }
    if (tool !== "measure") setMeasure(INITIAL_MEASURE);
    if (tool !== "fibonacci" && tool !== "fibext") setFibSketch(INITIAL_FIB);
  }, [tool]);

  function updateEMAs() {
    const c = candlesRef.current;
    if (c.length === 0) return;
    const cfg = configRef.current;
    const candles = toCandles(c);
    let last20: number | undefined, last50: number | undefined, last200: number | undefined;
    if (ema20Ref.current) { const d = ema(candles, cfg.ema20); ema20Ref.current.setData(d.map((p) => ({ time: p.time as UTCTimestamp, value: p.value }))); last20 = d.at(-1)?.value; }
    if (ema50Ref.current) { const d = ema(candles, cfg.ema50); ema50Ref.current.setData(d.map((p) => ({ time: p.time as UTCTimestamp, value: p.value }))); last50 = d.at(-1)?.value; }
    if (ema200Ref.current) { const d = ema(candles, cfg.ema200); ema200Ref.current.setData(d.map((p) => ({ time: p.time as UTCTimestamp, value: p.value }))); last200 = d.at(-1)?.value; }
    setLastValues((prev) => ({ ...prev, ema20: last20, ema50: last50, ema200: last200, volume: c.at(-1)?.volume }));
  }

  function updateRSI() {
    const c = candlesRef.current;
    if (c.length === 0 || !rsiRef.current) return;
    const data = rsi(toCandles(c), configRef.current.rsi).map((p) => ({ time: p.time as UTCTimestamp, value: p.value }));
    rsiRef.current.setData(data);
    if (rsi30Ref.current && data.length > 0) rsi30Ref.current.setData([{ time: data[0].time, value: 30 }, { time: data[data.length - 1].time, value: 30 }]);
    if (rsi70Ref.current && data.length > 0) rsi70Ref.current.setData([{ time: data[0].time, value: 70 }, { time: data[data.length - 1].time, value: 70 }]);
    setLastValues((prev) => ({ ...prev, rsi: data.at(-1)?.value }));
  }

  function updateMACD() {
    const c = candlesRef.current;
    if (c.length === 0 || !macdRef.current) return;
    const cfg = configRef.current;
    const m = macd(toCandles(c), cfg.macdFast, cfg.macdSlow, cfg.macdSignal);
    macdRef.current.setData(m.map((p) => ({ time: p.time as UTCTimestamp, value: p.macd })));
    macdSignalRef.current?.setData(m.map((p) => ({ time: p.time as UTCTimestamp, value: p.signal })));
    macdHistRef.current?.setData(m.map((p) => ({ time: p.time as UTCTimestamp, value: p.histogram, color: p.histogram >= 0 ? `${TV_COLORS.green}80` : `${TV_COLORS.red}80` })));
    const last = m.at(-1);
    setLastValues((prev) => ({ ...prev, macd: last?.macd, macdSignal: last?.signal, macdHist: last?.histogram }));
  }

  const greenOrRed = (n: number) => n >= 0 ? "text-tv-green" : "text-tv-red";
  const rsiPaneIdx = 1;
  const macdPaneIdx = indicators.rsi ? 2 : 1;
  const containerWidth = containerRef.current?.clientWidth ?? 800;

  // Measure overlay
  let measureRender: React.ReactNode = null;
  if (measure.a && measure.b && chartRef.current && candleSeriesRef.current) {
    const ts = chartRef.current.timeScale();
    const aX = ts.timeToCoordinate(measure.a.time as UTCTimestamp);
    const bX = ts.timeToCoordinate(measure.b.time as UTCTimestamp);
    const aY = candleSeriesRef.current.priceToCoordinate(measure.a.price);
    const bY = candleSeriesRef.current.priceToCoordinate(measure.b.price);
    if (aX !== null && bX !== null && aY !== null && bY !== null) {
      const priceDiff = measure.b.price - measure.a.price;
      const pctChange = measure.a.price === 0 ? 0 : (priceDiff / measure.a.price) * 100;
      const isUp = priceDiff >= 0;
      const start = Math.min(measure.a.time, measure.b.time);
      const end = Math.max(measure.a.time, measure.b.time);
      const inRange = candlesRef.current.filter((c) => Number(c.time) >= start && Number(c.time) <= end);
      const bars = inRange.length;
      const volume = inRange.reduce((s, c) => s + c.volume, 0);
      measureRender = (
        <MeasureOverlay
          aX={aX} aY={aY} bX={bX} bY={bY}
          priceDiff={priceDiff} pctChange={pctChange}
          bars={bars} volume={volume}
          durationText={durationLabel(measure.a.time, measure.b.time)}
          isUp={isUp} isPreview={measure.phase === "placing"}
        />
      );
    }
  }

  // Fibonacci overlays
  const fibOverlays: React.ReactNode[] = [];
  const priceToCoord = (price: number) => candleSeriesRef.current?.priceToCoordinate(price) ?? null;

  // In-progress sketch
  if (fibSketch.phase === "placing" && fibSketch.a !== null && fibSketch.b !== null) {
    const high = Math.max(fibSketch.a, fibSketch.b);
    const low = Math.min(fibSketch.a, fibSketch.b);
    const type = tool === "fibext" ? "extension" : "retracement";
    const levels = computeFibLevels(high, low, type, priceToCoord);
    fibOverlays.push(
      <FibonacciOverlay key="sketch" levels={levels} chartWidth={containerWidth} isPreview formatPrice={formatARS} />
    );
  }

  // Completed drawings
  for (const d of fibDrawings.filter((d) => d.symbol === selectedSymbol)) {
    const levels = computeFibLevels(d.highPrice, d.lowPrice, d.type, priceToCoord, d.color);
    fibOverlays.push(
      <FibonacciOverlay
        key={d.id}
        levels={levels}
        chartWidth={containerWidth}
        isSelected={selectedDrawingId === d.id}
        formatPrice={formatARS}
      />
    );
  }

  void renderTick;

  const activeIndicators = (Object.keys(indicators) as (keyof typeof indicators)[]).filter((k) => indicators[k]);
  const recentCandles = candlesRef.current.slice(-10).map((c) =>
    `${new Date((c.time as number) * 1000).toISOString().slice(0, 10)}: O=${formatARS(c.open)} H=${formatARS(c.high)} L=${formatARS(c.low)} C=${formatARS(c.close)}`
  ).join("\n");

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      onClick={() => { if (contextMenu) { setContextMenu(null); setSelectedDrawingId(null); } }}
    >
      <div ref={containerRef} className="h-full w-full" />
      {measureRender}
      {fibOverlays}

      {contextMenu && contextMenu.kind === "fib" && (() => {
        const d = fibDrawings.find((x) => x.id === contextMenu.id);
        if (!d) return null;
        return (
          <DrawingContextMenu
            kind="fib"
            x={contextMenu.x}
            y={contextMenu.y}
            color={d.color}
            fibType={d.type}
            onFibTypeChange={(t) => updateFibDrawing(d.id, { type: t })}
            onColorChange={(c) => updateFibDrawing(d.id, { color: c })}
            onDelete={() => removeFibDrawing(d.id)}
            onClose={() => { setContextMenu(null); setSelectedDrawingId(null); }}
          />
        );
      })()}

      {contextMenu && contextMenu.kind === "hline" && (() => {
        const pl = priceLines.find((x) => x.id === contextMenu.id);
        if (!pl) return null;
        return (
          <DrawingContextMenu
            kind="hline"
            x={contextMenu.x}
            y={contextMenu.y}
            color={pl.color}
            onColorChange={(c) => updatePriceLineColor(pl.id, c)}
            onDelete={() => removePriceLine(pl.id)}
            onClose={() => { setContextMenu(null); setSelectedDrawingId(null); }}
          />
        );
      })()}

      {error && !loading && candles.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded bg-tv-panel/90 px-4 py-3 text-center">
            <p className="text-xs text-tv-red mb-1">Error al cargar datos</p>
            <p className="text-[11px] text-tv-text-muted max-w-xs">{error}</p>
          </div>
        </div>
      )}

      {/* Top-left info overlay */}
      <div style={{ top: (paneOffsets[0]?.top ?? 0) + 12, left: 12 }} className="pointer-events-none absolute z-10 flex flex-col gap-1 text-xs tabular-nums">
        <div className="flex h-5 flex-nowrap items-center gap-x-3 overflow-hidden whitespace-nowrap">
          <div className="flex shrink-0 items-center gap-2 text-[13px] font-semibold">
            <span className="text-tv-text">{selectedSymbol}</span>
            <span className="text-tv-text-muted">·</span>
            <span className="text-tv-text-muted">Diario</span>
            <span className="text-tv-text-muted">·</span>
            <span className="text-tv-text-muted">BYMA</span>
          </div>
          {hover && (
            <div className="flex items-center gap-x-3 text-[11px]">
              <span className="text-tv-text-muted">O <span className={greenOrRed(hover.c - hover.o)}>{formatARS(hover.o)}</span></span>
              <span className="text-tv-text-muted">H <span className={greenOrRed(hover.c - hover.o)}>{formatARS(hover.h)}</span></span>
              <span className="text-tv-text-muted">L <span className={greenOrRed(hover.c - hover.o)}>{formatARS(hover.l)}</span></span>
              <span className="text-tv-text-muted">C <span className={greenOrRed(hover.c - hover.o)}>{formatARS(hover.c)}</span></span>
              <span className={greenOrRed(hover.pct)}>{hover.pct >= 0 ? "+" : ""}{hover.pct.toFixed(2)}%</span>
              <span className="text-tv-text-muted">Vol <span className="text-tv-text">{formatVolume(hover.v)}</span></span>
            </div>
          )}
        </div>
        <div className="flex h-7 items-center gap-2">
          {lastPrice ? (
            <>
              <span className={`text-lg font-semibold tabular-nums ${greenOrRed(lastPrice.pct)}`}>{formatARS(lastPrice.value)}</span>
              <span className={`text-xs ${greenOrRed(lastPrice.pct)}`}>{formatPct(lastPrice.pct)}</span>
            </>
          ) : loading ? (
            <span className="text-xs text-tv-text-muted">Cargando…</span>
          ) : null}
        </div>
        <div className="mt-1 flex flex-col items-start gap-1">
          {indicators.ema20 && <IndicatorPill name={`EMA ${config.ema20}`} value={lastValues.ema20 !== undefined ? formatARS(lastValues.ema20) : undefined} color={INDICATOR_COLORS.ema20} hidden={hidden.ema20} onToggleHide={() => toggleHidden("ema20")} onSettings={() => setSettingsTarget("ema20")} onRemove={() => removeIndicator("ema20")} />}
          {indicators.ema50 && <IndicatorPill name={`EMA ${config.ema50}`} value={lastValues.ema50 !== undefined ? formatARS(lastValues.ema50) : undefined} color={INDICATOR_COLORS.ema50} hidden={hidden.ema50} onToggleHide={() => toggleHidden("ema50")} onSettings={() => setSettingsTarget("ema50")} onRemove={() => removeIndicator("ema50")} />}
          {indicators.ema200 && <IndicatorPill name={`EMA ${config.ema200}`} value={lastValues.ema200 !== undefined ? formatARS(lastValues.ema200) : undefined} color={INDICATOR_COLORS.ema200} hidden={hidden.ema200} onToggleHide={() => toggleHidden("ema200")} onSettings={() => setSettingsTarget("ema200")} onRemove={() => removeIndicator("ema200")} />}
          {indicators.volume && <IndicatorPill name="Vol" value={lastValues.volume !== undefined ? formatVolume(lastValues.volume) : undefined} color={INDICATOR_COLORS.volume} hidden={hidden.volume} onToggleHide={() => toggleHidden("volume")} onSettings={() => setSettingsTarget("volume")} onRemove={() => removeIndicator("volume")} />}
        </div>
      </div>

      {/* RSI pane label */}
      {indicators.rsi && paneOffsets[rsiPaneIdx] && (
        <div style={{ top: paneOffsets[rsiPaneIdx].top + 6, left: 12 }} className="pointer-events-none absolute z-10">
          <IndicatorPill name={`RSI ${config.rsi}`} value={lastValues.rsi !== undefined ? lastValues.rsi.toFixed(2) : undefined} color={INDICATOR_COLORS.rsi} hidden={hidden.rsi} onToggleHide={() => toggleHidden("rsi")} onSettings={() => setSettingsTarget("rsi")} onRemove={() => removeIndicator("rsi")} />
        </div>
      )}

      {/* MACD pane label */}
      {indicators.macd && paneOffsets[macdPaneIdx] && (
        <div style={{ top: paneOffsets[macdPaneIdx].top + 6, left: 12 }} className="pointer-events-none absolute z-10">
          <IndicatorPill name={`MACD ${config.macdFast}, ${config.macdSlow}, ${config.macdSignal}`} value={lastValues.macd !== undefined ? `${lastValues.macd.toFixed(2)} / ${(lastValues.macdSignal ?? 0).toFixed(2)}` : undefined} color={INDICATOR_COLORS.macd} hidden={hidden.macd} onToggleHide={() => toggleHidden("macd")} onSettings={() => setSettingsTarget("macd")} onRemove={() => removeIndicator("macd")} />
        </div>
      )}

      {/* Date range selector */}
      <div className="pointer-events-auto absolute right-3 top-3 z-10 flex items-center gap-0.5 rounded bg-tv-panel px-1 py-1">
        {DATE_RANGES.map((r) => (
          <button key={r} onClick={() => setDateRange(r)} className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${dateRange === r ? "bg-tv-blue/20 text-tv-blue" : "text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"}`}>
            {r}
          </button>
        ))}
      </div>

      <AlertsPanel symbol={selectedSymbol} market="argentina" currentPrice={lastPrice?.value ?? 0} />
      <AiPanel context={{
        symbol: selectedSymbol,
        price: lastPrice ? formatARS(lastPrice.value) : "—",
        pct: lastPrice ? lastPrice.pct.toFixed(2) : "0",
        market: "argentina",
        indicators: activeIndicators,
        candles: recentCandles || undefined,
      }} />
    </div>
  );
}
