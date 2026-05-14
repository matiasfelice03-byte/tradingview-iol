import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { IolDateRange } from "@/lib/iol/rest";

export type Market = "crypto" | "argentina";

export const DEFAULT_ARGENTINA_WATCHLIST = [
  "GGAL",
  "YPF",
  "PAMP",
  "BBAR",
  "BMA",
  "TXAR",
  "ALUA",
  "VIST",
  "METR",
  "TECO2",
  "AAPL",
  "MSFT",
  "GOOGL",
  "NVDA",
  "TSLA",
  "META",
  "MELI",
  "AMZN",
];

interface IolState {
  market: Market;
  isLoggedIn: boolean;
  selectedSymbol: string;
  watchlistArgentina: string[];
  dateRange: IolDateRange;

  setMarket: (m: Market) => void;
  setLoggedIn: (v: boolean) => void;
  setSelectedSymbol: (s: string) => void;
  addToArgentinaWatchlist: (s: string) => void;
  removeFromArgentinaWatchlist: (s: string) => void;
  setDateRange: (r: IolDateRange) => void;
}

export const useIolStore = create<IolState>()(
  persist(
    (set) => ({
      market: "crypto",
      isLoggedIn: false,
      selectedSymbol: "GGAL",
      watchlistArgentina: DEFAULT_ARGENTINA_WATCHLIST,
      dateRange: "3M",

      setMarket: (market) => set({ market }),
      setLoggedIn: (isLoggedIn) => set({ isLoggedIn }),
      setSelectedSymbol: (selectedSymbol) => set({ selectedSymbol }),
      addToArgentinaWatchlist: (s) =>
        set((state) => ({
          watchlistArgentina: state.watchlistArgentina.includes(s)
            ? state.watchlistArgentina
            : [...state.watchlistArgentina, s],
        })),
      removeFromArgentinaWatchlist: (s) =>
        set((state) => ({
          watchlistArgentina: state.watchlistArgentina.filter((x) => x !== s),
        })),
      setDateRange: (dateRange) => set({ dateRange }),
    }),
    {
      name: "iol-store",
      partialize: (s) => ({
        market: s.market,
        isLoggedIn: s.isLoggedIn,
        selectedSymbol: s.selectedSymbol,
        watchlistArgentina: s.watchlistArgentina,
        dateRange: s.dateRange,
      }),
    },
  ),
);
