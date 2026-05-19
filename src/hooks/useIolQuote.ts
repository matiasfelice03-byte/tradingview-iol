import { useEffect, useState } from "react";
import { fetchIolQuote } from "@/lib/iol/rest";
import type { IolQuote } from "@/lib/iol/types";

export function useIolQuote(simbolo: string | null): {
  quote: IolQuote | null;
  error: string | null;
  loading: boolean;
} {
  const [quote, setQuote] = useState<IolQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!simbolo) return;
    let cancelled = false;
    setLoading(true);
    setQuote(null);

    const poll = async () => {
      try {
        const q = await fetchIolQuote(simbolo);
        if (!cancelled) { setQuote(q); setError(null); setLoading(false); }
      } catch (e) {
        if (!cancelled) { setError((e as Error).message); setLoading(false); }
      }
    };

    poll();
    const id = setInterval(poll, 15_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [simbolo]);

  return { quote, error, loading };
}
