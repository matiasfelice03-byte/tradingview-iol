"use client";
import { useEffect } from "react";
export function SwUnregister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const r of regs) r.unregister();
      });
    }
  }, []);
  return null;
}
