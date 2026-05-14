import { useEffect, useState } from "react";
import { fetchYahooCandles, type IolTimeframe } from "@/lib/yahoo/rest";
import type { IolCandle } from "@/lib/iol/rest";

export function useIolHistorical(
  simbolo: string | null,
  timeframe: IolTimeframe = "1D",
): {
  candles: IolCandle[];
  error: string | null;
  loading: boolean;
} {
  const [candles, setCandles] = useState<IolCandle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!simbolo) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchYahooCandles(simbolo + ".BA", timeframe)
      .then((data) => {
        if (!cancelled) {
          setCandles(data);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError((e as Error).message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [simbolo, timeframe]);

  return { candles, error, loading };
}
