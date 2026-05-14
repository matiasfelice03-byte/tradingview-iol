import { useIolStore, type Market } from "@/lib/store/iol-store";

export function useMarket(): {
  market: Market;
  isCrypto: boolean;
  isArgentina: boolean;
  setMarket: (m: Market) => void;
} {
  const market = useIolStore((s) => s.market);
  const setMarket = useIolStore((s) => s.setMarket);
  return {
    market,
    isCrypto: market === "crypto",
    isArgentina: market === "argentina",
    setMarket,
  };
}
