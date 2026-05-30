import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface WatchlistItem {
  symbol: string;
  market: "argentina" | "crypto";
}

export interface Watchlist {
  id: string;
  name: string;
  items: WatchlistItem[];
}

export interface Annotation {
  symbol: string;
  text: string;
  updatedAt: number;
}

export interface PriceAlert {
  id: string;
  symbol: string;
  market: "argentina" | "crypto";
  direction: "above" | "below";
  targetPrice: number;
  message: string;
  active: boolean;
  triggered: boolean;
  createdAt: number;
  action?: {
    type: "buy" | "sell";
    quantity: number;
    orderType: "precioLimite" | "precioMercado";
    plazo: "T0" | "T1" | "T2";
  };
}

interface ExplorarState {
  watchlists: Watchlist[];
  annotations: Annotation[];
  alerts: PriceAlert[];
  /** Currently selected custom list id (null = default market list) */
  selectedListId: string | null;

  setSelectedListId: (id: string | null) => void;
  addWatchlist: (name: string) => void;
  setWatchlists: (lists: Watchlist[]) => void;
  removeWatchlist: (id: string) => void;
  renameWatchlist: (id: string, name: string) => void;
  addToWatchlist: (listId: string, item: WatchlistItem) => void;
  removeFromWatchlist: (listId: string, symbol: string) => void;
  setAnnotation: (symbol: string, text: string) => void;
  addAlert: (
    alert: Omit<PriceAlert, "id" | "triggered" | "createdAt">,
  ) => void;
  removeAlert: (id: string) => void;
  triggerAlert: (id: string) => void;
  toggleAlert: (id: string) => void;
}

export const useExplorarStore = create<ExplorarState>()(
  persist(
    (set) => ({
      watchlists: [],
      annotations: [],
      alerts: [],
      selectedListId: null,

      setSelectedListId: (selectedListId) => set({ selectedListId }),

      addWatchlist: (name) =>
        set((s) => ({
          watchlists: [
            ...s.watchlists,
            { id: crypto.randomUUID(), name, items: [] },
          ],
        })),

      setWatchlists: (lists) => set({ watchlists: lists }),

      removeWatchlist: (id) =>
        set((s) => ({
          watchlists: s.watchlists.filter((w) => w.id !== id),
          selectedListId: s.selectedListId === id ? null : s.selectedListId,
        })),

      renameWatchlist: (id, name) =>
        set((s) => ({
          watchlists: s.watchlists.map((w) =>
            w.id === id ? { ...w, name } : w,
          ),
        })),

      addToWatchlist: (listId, item) =>
        set((s) => ({
          watchlists: s.watchlists.map((w) =>
            w.id === listId
              ? {
                  ...w,
                  items: w.items.some((i) => i.symbol === item.symbol)
                    ? w.items
                    : [...w.items, item],
                }
              : w,
          ),
        })),

      removeFromWatchlist: (listId, symbol) =>
        set((s) => ({
          watchlists: s.watchlists.map((w) =>
            w.id === listId
              ? { ...w, items: w.items.filter((i) => i.symbol !== symbol) }
              : w,
          ),
        })),

      setAnnotation: (symbol, text) =>
        set((s) => {
          const existing = s.annotations.find((a) => a.symbol === symbol);
          if (existing) {
            return {
              annotations: s.annotations.map((a) =>
                a.symbol === symbol
                  ? { ...a, text, updatedAt: Date.now() }
                  : a,
              ),
            };
          }
          return {
            annotations: [
              ...s.annotations,
              { symbol, text, updatedAt: Date.now() },
            ],
          };
        }),

      addAlert: (alert) =>
        set((s) => ({
          alerts: [
            ...s.alerts,
            {
              ...alert,
              id: crypto.randomUUID(),
              triggered: false,
              createdAt: Date.now(),
            },
          ],
        })),

      removeAlert: (id) =>
        set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),

      triggerAlert: (id) =>
        set((s) => ({
          alerts: s.alerts.map((a) =>
            a.id === id ? { ...a, triggered: true, active: false } : a,
          ),
        })),

      toggleAlert: (id) =>
        set((s) => ({
          alerts: s.alerts.map((a) =>
            a.id === id ? { ...a, active: !a.active } : a,
          ),
        })),
    }),
    { name: "explorar-store" },
  ),
);
