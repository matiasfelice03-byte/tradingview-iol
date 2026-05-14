import { useEffect, useState } from "react";
import { fetchYahooCandles, type IolTimeframe } from "@/lib/yahoo/rest";
import { fetchIolHistorical, type IolCandle, type IolDateRange } from "@/lib/iol/rest";

const TF_TO_IOL_RANGE: Partial<Record<IolTimeframe, IolDateRange>> = {
  "1D": "5A",
  "1S": "5A",
  "1M": "5A",
};

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

    const iolRange = TF_TO_IOL_RANGE[timeframe];
    const load = iolRange
      ? fetchIolHistorical(simbolo, iolRange)
      : fetchYahooCandles(simbolo + ".BA", timeframe);

    load
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
