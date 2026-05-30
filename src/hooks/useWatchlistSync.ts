"use client";

import { useEffect, useRef, useState } from "react";
import { useExplorarStore } from "@/lib/store/explorar-store";
import { useIolStore } from "@/lib/store/iol-store";
import { iolAuth } from "@/lib/iol/auth";

/**
 * Syncs custom watchlists with the server, keyed by IOL account.
 * On login: pulls the account's lists (server is source of truth).
 * On change: debounced push so the same account sees the same lists on any device.
 * If not logged in to IOL, falls back to localStorage only (no sync).
 */
export function useWatchlistSync() {
  const isLoggedIn = useIolStore((s) => s.isLoggedIn);
  const watchlists = useExplorarStore((s) => s.watchlists);
  const setWatchlists = useExplorarStore((s) => s.setWatchlists);

  const [pulled, setPulled] = useState(false);
  const skipNextPush = useRef(false);

  // Pull on login
  useEffect(() => {
    if (!isLoggedIn) {
      setPulled(false);
      return;
    }
    const creds = iolAuth.getCredentials();
    if (!creds) return;

    let cancelled = false;
    fetch(`/api/watchlists?user=${encodeURIComponent(creds.username)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) {
          setPulled(true);
          return;
        }
        // Server has lists → adopt them (account is source of truth).
        // Server empty → keep local; the push effect uploads them next.
        if (Array.isArray(d.watchlists) && d.watchlists.length > 0) {
          skipNextPush.current = true;
          setWatchlists(d.watchlists);
        }
        setPulled(true);
      })
      .catch(() => setPulled(true));

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, setWatchlists]);

  // Push on change (debounced)
  useEffect(() => {
    if (!isLoggedIn || !pulled) return;
    if (skipNextPush.current) {
      skipNextPush.current = false;
      return;
    }
    const creds = iolAuth.getCredentials();
    if (!creds) return;

    const t = setTimeout(() => {
      fetch("/api/watchlists", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: creds.username, watchlists }),
      }).catch(() => {});
    }, 1500);

    return () => clearTimeout(t);
  }, [watchlists, isLoggedIn, pulled]);
}
