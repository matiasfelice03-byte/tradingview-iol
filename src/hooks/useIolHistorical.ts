import { useEffect, useState } from "react";
import { fetchYahooCandles, type IolTimeframe } from "@/lib/yahoo/rest";
import { fetchIolHistorical, normalizeIolSymbol, type IolCandle, type IolDateRange } from "@/lib/iol/rest";

const IOL_TIMEFRAMES: IolTimeframe[] = ["1D", "1S", "1M"];
// La serie histórica de IOL se queda corta en rangos largos (devuelve ~1 año).
// Para estos rangos usamos Yahoo Finance, que sí tiene historial completo.
const YAHOO_ONLY_RANGES: IolDateRange[] = ["1A", "5A"];

export function useIolHistorical(
  simbolo: string | null,
  timeframe: IolTimeframe = "1D",
  dateRange: IolDateRange = "1A",
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

    const usesIol = IOL_TIMEFRAMES.includes(timeframe) && !YAHOO_ONLY_RANGES.includes(dateRange);
    const yahooFallback = () => fetchYahooCandles(normalizeIolSymbol(simbolo) + ".BA", timeframe, dateRange);
    const load = usesIol
      ? fetchIolHistorical(simbolo, dateRange)
          .then((data) => (data.length > 0 ? data : yahooFallback()))
          .catch(yahooFallback)
      : yahooFallback();

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
  }, [simbolo, timeframe, dateRange]);

  return { candles, error, loading };
}
