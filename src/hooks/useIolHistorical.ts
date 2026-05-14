import { useEffect, useState } from "react";
import { fetchYahooCandles } from "@/lib/yahoo/rest";
import type { IolCandle } from "@/lib/iol/rest";
import type { IolDateRange } from "@/lib/iol/rest";

export function useIolHistorical(
  simbolo: string | null,
  range: IolDateRange,
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

    // Yahoo Finance uses ".BA" suffix for Argentine/BYMA stocks
    fetchYahooCandles(simbolo + ".BA", range)
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
  }, [simbolo, range]);

  return { candles, error, loading };
}
