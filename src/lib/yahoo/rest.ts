import type { UTCTimestamp } from "lightweight-charts";
import type { IolCandle } from "@/lib/iol/rest";

export type IolTimeframe = "1H" | "4H" | "1D" | "1S" | "1M";

// Yahoo Finance doesn't have native 4h — fetch 1h and aggregate
const TF_MAP: Record<Exclude<IolTimeframe, "4H">, { interval: string; range: string }> = {
  "1H": { interval: "60m", range: "60d" },
  "1D": { interval: "1d",  range: "1y"  },
  "1S": { interval: "1wk", range: "5y"  },
  "1M": { interval: "1mo", range: "max" },
};

function aggregate4h(candles: IolCandle[]): IolCandle[] {
  if (candles.length === 0) return [];
  const result: IolCandle[] = [];
  let i = 0;
  while (i < candles.length) {
    const block = candles.slice(i, i + 4);
    result.push({
      time: block[0].time,
      open: block[0].open,
      high: Math.max(...block.map((c) => c.high)),
      low: Math.min(...block.map((c) => c.low)),
      close: block[block.length - 1].close,
      volume: block.reduce((s, c) => s + c.volume, 0),
    });
    i += 4;
  }
  return result;
}

async function fetchRaw(symbol: string, interval: string, range: string): Promise<IolCandle[]> {
  const path = `/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
  let res: Response;
  try {
    // Fetch directly from browser — avoids Vercel IP blocking by Yahoo Finance
    res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart${path}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`${res.status}`);
  } catch {
    // Fallback to Next.js proxy rewrite
    res = await fetch(`/api/yahoo/v8/finance/chart${path}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Yahoo Finance ${res.status}: ${symbol}`);
  }
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

export async function fetchYahooCandles(
  symbol: string,
  timeframe: IolTimeframe = "1D",
): Promise<IolCandle[]> {
  if (timeframe === "4H") {
    // Fetch 1h data for 120 days and aggregate into 4h blocks
    const raw = await fetchRaw(symbol, "60m", "120d");
    return aggregate4h(raw);
  }
  const { interval, range } = TF_MAP[timeframe];
  return fetchRaw(symbol, interval, range);
}
