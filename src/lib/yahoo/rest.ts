import type { UTCTimestamp } from "lightweight-charts";
import type { IolCandle } from "@/lib/iol/rest";

const BASE = "/api/yahoo/v8/finance/chart";

export type IolTimeframe = "1H" | "1D" | "1S" | "1M";

// Maps each candle timeframe to Yahoo Finance interval + range
const TF_MAP: Record<IolTimeframe, { interval: string; range: string }> = {
  "1H": { interval: "60m",  range: "60d"  },
  "1D": { interval: "1d",   range: "1y"   },
  "1S": { interval: "1wk",  range: "5y"   },
  "1M": { interval: "1mo",  range: "max"  },
};

export async function fetchYahooCandles(
  symbol: string,
  timeframe: IolTimeframe = "1D",
): Promise<IolCandle[]> {
  const { interval, range } = TF_MAP[timeframe];
  const res = await fetch(
    `${BASE}/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`,
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
