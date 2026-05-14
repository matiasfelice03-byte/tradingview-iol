"use client";

import { useEffect } from "react";
import { useExplorarStore } from "@/lib/store/explorar-store";
import { fetchIolQuote } from "@/lib/iol/rest";

export function useAlertChecker() {
  const alerts = useExplorarStore((s) => s.alerts);
  const triggerAlert = useExplorarStore((s) => s.triggerAlert);

  useEffect(() => {
    async function check() {
      const active = alerts.filter((a) => a.active && !a.triggered);
      if (active.length === 0) return;

      for (const alert of active) {
        try {
          let price: number | null = null;

          if (alert.market === "crypto") {
            const res = await fetch(
              `https://api.binance.com/api/v3/ticker/price?symbol=${alert.symbol}USDT`,
            );
            if (res.ok) {
              const data = await res.json();
              price = parseFloat(data.price);
            }
          } else {
            const quote = await fetchIolQuote(alert.symbol);
            price = quote.ultimoPrecio ?? null;
          }

          if (price === null) continue;

          const conditionMet =
            alert.direction === "above"
              ? price >= alert.targetPrice
              : price <= alert.targetPrice;

          if (conditionMet) {
            triggerAlert(alert.id);

            if (
              typeof window !== "undefined" &&
              "Notification" in window &&
              Notification.permission === "granted"
            ) {
              new Notification(alert.message || "Alerta de precio", {
                body: `${alert.symbol} llegó a ${price}`,
              });
            }

            if (alert.action && alert.market === "argentina") {
              const { placeIolBuyOrder, placeIolSellOrder } = await import(
                "@/lib/iol/rest"
              );
              const order = {
                simbolo: alert.symbol,
                cantidad: alert.action.quantity,
                precio: alert.targetPrice,
                tipoOrden: alert.action.orderType,
                plazo: alert.action.plazo,
                mercado: "bCBA",
                validez: new Date().toISOString().split("T")[0],
              };
              if (alert.action.type === "buy") {
                await placeIolBuyOrder(order as never);
              } else {
                await placeIolSellOrder(order as never);
              }
            }
          }
        } catch {
          // silently ignore per-alert errors
        }
      }
    }

    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [alerts, triggerAlert]);
}
