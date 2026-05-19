import type { UTCTimestamp } from "lightweight-charts";
import { iolAuth } from "./auth";
import type {
  IolQuote,
  IolHistoricalBar,
  IolOrderRequest,
  IolPortfolioItem,
} from "./types";

const BASE = "/api/iol/api/v2";

async function iolFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await iolAuth.getAccessToken();
  const isGet = !options.method || options.method === "GET";
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(isGet ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.text();
      // Try to extract a readable message from IOL's JSON error
      const json = JSON.parse(body);
      detail = json?.message ?? json?.Message ?? json?.error ?? body;
    } catch {
      detail = res.statusText || "";
    }
    const hint =
      res.status === 500
        ? " (posibles causas: mercado cerrado, saldo insuficiente, o precio fuera de rango)"
        : res.status === 401
        ? " (sesión expirada — volvé a iniciar sesión)"
        : "";
    throw new Error(`IOL ${res.status}${detail ? ": " + detail : ""}${hint}`);
  }
  // IOL sometimes returns HTTP 200 with an auth-denied JSON instead of a real 401
  const clone = res.clone();
  try {
    const body = await clone.json();
    const msg: string = body?.message ?? body?.Message ?? "";
    if (msg && (msg.toLowerCase().includes("denied") || msg.toLowerCase().includes("authorization"))) {
      iolAuth.clearTokens(); // Bad token — clear so next call re-authenticates with stored credentials
      throw new Error(`IOL sesión inválida: ${msg} — volvé a iniciar sesión`);
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("IOL sesión")) throw e;
    // Body isn't JSON or has no auth error message — continue normally
  }
  return res;
}

export async function fetchIolQuote(simbolo: string): Promise<IolQuote> {
  const res = await iolFetch(`/bCBA/Titulos/${encodeURIComponent(simbolo)}/Cotizacion`);
  const data = await res.json();
  if (typeof data?.ultimoPrecio !== "number") {
    throw new Error(data?.message ?? "IOL: respuesta de cotización inválida");
  }
  return data as IolQuote;
}

export interface IolCandle {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function dateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type IolDateRange = "1M" | "3M" | "6M" | "1A" | "5A";

function rangeToDates(range: IolDateRange): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  switch (range) {
    case "1M":
      from.setMonth(from.getMonth() - 1);
      break;
    case "3M":
      from.setMonth(from.getMonth() - 3);
      break;
    case "6M":
      from.setMonth(from.getMonth() - 6);
      break;
    case "1A":
      from.setFullYear(from.getFullYear() - 1);
      break;
    case "5A":
      from.setFullYear(from.getFullYear() - 5);
      break;
  }
  return { from: dateStr(from), to: dateStr(to) };
}

export async function fetchIolHistorical(
  simbolo: string,
  range: IolDateRange,
  ajustada: "ajustada" | "sinAjustar" = "ajustada",
): Promise<IolCandle[]> {
  const { from, to } = rangeToDates(range);
  const res = await iolFetch(
    `/bCBA/Titulos/${encodeURIComponent(simbolo)}/Cotizacion/seriehistorica/${from}/${to}/${ajustada}`,
  );
  const raw = await res.json();
  const data: IolHistoricalBar[] = Array.isArray(raw) ? raw : [];
  return data
    .filter((bar) => bar.apertura != null && bar.cierre != null && bar.maximo != null && bar.minimo != null && bar.cierre > 0)
    .map((bar) => {
      const dateOnly = bar.fechaHora.substring(0, 10); // "YYYY-MM-DD"
      const time = (new Date(dateOnly + "T00:00:00Z").getTime() / 1000) as UTCTimestamp;
      return {
        time,
        open: bar.apertura,
        high: bar.maximo,
        low: bar.minimo,
        close: bar.cierre,
        volume: bar.volumen ?? 0,
      };
    })
    .sort((a, b) => a.time - b.time);
}

export async function placeIolBuyOrder(order: IolOrderRequest): Promise<void> {
  await iolFetch("/operar/Comprar", {
    method: "POST",
    body: JSON.stringify(order),
  });
}

export async function placeIolSellOrder(order: IolOrderRequest): Promise<void> {
  await iolFetch("/operar/Vender", {
    method: "POST",
    body: JSON.stringify(order),
  });
}

export async function fetchIolPortfolio(): Promise<IolPortfolioItem[]> {
  const res = await iolFetch("/portafolio/bCBA");
  const data = await res.json();
  return data.activos ?? [];
}
