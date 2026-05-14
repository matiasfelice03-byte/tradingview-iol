import type { UTCTimestamp } from "lightweight-charts";
import type { IolCandle } from "@/lib/iol/rest";
import type { IolDateRange } from "@/lib/iol/rest";

const BASE = "/api/yahoo/v8/finance/chart";

const RANGE_MAP: Record<IolDateRange, string> = {
  "1M": "1mo",
  "3M": "3mo",
  "6M": "6mo",
  "1A": "1y",
  "5A": "5y",
};

export async function fetchYahooCandles(
  symbol: string,
  range: IolDateRange,
): Promise<IolCandle[]> {
  const r = RANGE_MAP[range];
  const res = await fetch(
    `${BASE}/${encodeURIComponent(symbol)}?interval=1d&range=${r}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Yahoo Finance ${res.status}: ${symbol}`);

  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error("Yahoo Finance: sin datos para " + symbol);

  const timestamps: number[] = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0] ?? {};
  const opens: (number | null)[] = q.open ?? [];
  const highs: (number | null)[] = q.high ?? [];
  const lows: (number | null)[] = q.low ?? [];
  const closes: (number | null)[] = q.close ?? [];
  const volumes: (number | null)[] = q.volume ?? [];

  return timestamps
    .map((t, i) => ({
      time: t as UTCTimestamp,
      open: opens[i] ?? 0,
      high: highs[i] ?? 0,
      low: lows[i] ?? 0,
      close: closes[i] ?? 0,
      volume: volumes[i] ?? 0,
    }))
    .filter((c) => c.open > 0 && c.close > 0)
    .sort((a, b) => a.time - b.time);
}
