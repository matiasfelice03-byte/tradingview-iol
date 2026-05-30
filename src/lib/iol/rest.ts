import type { UTCTimestamp } from "lightweight-charts";
import { iolAuth } from "./auth";
import type {
  IolQuote,
  IolHistoricalBar,
  IolOrderRequest,
  IolPortfolioItem,
} from "./types";

const BASE = "/api/iol/api/v2";

/**
 * Algunos tickers BYMA difieren del nombre común. Ej: la acción local de YPF
 * cotiza como "YPFD" ("YPF" es el ADR de NYSE y da 404 en IOL/Yahoo .BA).
 */
const IOL_SYMBOL_ALIASES: Record<string, string> = {
  YPF: "YPFD",
};

/** Convierte un símbolo a su ticker real en BYMA (IOL/Yahoo). */
export function normalizeIolSymbol(simbolo: string): string {
  return IOL_SYMBOL_ALIASES[simbolo.toUpperCase()] ?? simbolo;
}

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
  const sym = normalizeIolSymbol(simbolo);
  const res = await iolFetch(`/bCBA/Titulos/${encodeURIComponent(sym)}/Cotizacion`);
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
  const sym = normalizeIolSymbol(simbolo);
  const res = await iolFetch(
    `/bCBA/Titulos/${encodeURIComponent(sym)}/Cotizacion/seriehistorica/${from}/${to}/${ajustada}`,
  );
  const raw = await res.json();
  const data: IolHistoricalBar[] = Array.isArray(raw) ? raw : [];
  const mapped = data
    .filter((bar) => bar.apertura != null && bar.ultimoPrecio != null && bar.maximo != null && bar.minimo != null && bar.ultimoPrecio > 0)
    .map((bar) => {
      const dateOnly = bar.fechaHora.substring(0, 10); // "YYYY-MM-DD"
      const time = (new Date(dateOnly + "T00:00:00Z").getTime() / 1000) as UTCTimestamp;
      return {
        time,
        open: bar.apertura,
        high: bar.maximo,
        low: bar.minimo,
        close: bar.ultimoPrecio,
        volume: bar.volumenNominal ?? 0,
      };
    })
    .sort((a, b) => a.time - b.time);
  // Dedupe by timestamp — IOL can return multiple intraday bars collapsing to the same day.
  // Aggregate them: open from first, close from last, high/low extreme, sum volumes.
  const byTime = new Map<number, IolCandle>();
  for (const c of mapped) {
    const existing = byTime.get(c.time as number);
    if (!existing) {
      byTime.set(c.time as number, c);
    } else {
      existing.high = Math.max(existing.high, c.high);
      existing.low = Math.min(existing.low, c.low);
      existing.close = c.close;
      existing.volume += c.volume;
    }
  }
  return Array.from(byTime.values());
}

export interface IolOrderResult {
  numeroOperacion?: number;
}

/** IOL devuelve HTTP 200 incluso cuando la orden falla — hay que mirar el body. */
interface IolOrderResponse {
  ok?: boolean;
  messages?: Array<{ titulo?: string; descripcion?: string; tipo?: string }>;
  numeroOperacion?: number;
}

function parseIolOrderBody(body: IolOrderResponse): IolOrderResult {
  console.log("[orden] respuesta IOL:", body);
  const msgs = (body?.messages ?? [])
    .map((m) => [m.titulo, m.descripcion].filter(Boolean).join(": "))
    .filter(Boolean)
    .join(" | ");
  const raw = JSON.stringify(body);
  // ok === false => orden rechazada. Si ok es undefined, asumimos éxito solo si hay numeroOperacion.
  if (body?.ok === false) {
    throw new Error(`IOL rechazó la orden: ${msgs || raw}`);
  }
  if (body?.ok !== true && !body?.numeroOperacion) {
    throw new Error(`IOL no confirmó la orden: ${msgs || raw}`);
  }
  return { numeroOperacion: body?.numeroOperacion };
}

/** Fecha de validez de la orden (ISO). IOL requiere este campo o rechaza la orden. */
function orderValidez(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7); // válida 7 días
  d.setHours(23, 59, 0, 0);
  return d.toISOString();
}

async function placeOrder(action: "comprar" | "vender", order: IolOrderRequest): Promise<IolOrderResult> {
  const token = await iolAuth.getAccessToken();
  const normalizedOrder = {
    ...order,
    simbolo: normalizeIolSymbol(order.simbolo),
    validez: orderValidez(),
  };
  const path = action === "comprar" ? "Comprar" : "Vender";

  // IOL bloquea conexiones desde IPs de servidores en EE.UU. (Vercel) para el endpoint de trading.
  // Llamamos directo desde el browser (IP argentina) — igual que la app web de IOL.
  let res: Response;
  try {
    res = await fetch(`https://api.invertironline.com/api/v2/operar/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(normalizedOrder),
    });
  } catch {
    // CORS u otro error de red — fallback al route server-side
    const fallback = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, token, order: normalizedOrder }),
    });
    const data = await fallback.json() as { ok?: boolean; error?: string; data?: IolOrderResponse };
    if (!fallback.ok || !data.ok) throw new Error(data.error ?? `Error ${fallback.status}`);
    return parseIolOrderBody(data.data ?? {});
  }

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.message ?? body?.Message ?? body?.error ?? JSON.stringify(body);
    } catch {
      detail = await res.text().catch(() => "");
    }
    const hint =
      res.status === 500
        ? " (precio fuera de rango, mercado cerrado o saldo insuficiente)"
        : res.status === 401
        ? " (sesión expirada — volvé a iniciar sesión)"
        : res.status === 503
        ? " (servidor de IOL no disponible — intentá de nuevo)"
        : "";
    throw new Error(`IOL ${res.status}${detail ? ": " + detail : ""}${hint}`);
  }

  const body = (await res.json().catch(() => ({}))) as IolOrderResponse;
  return parseIolOrderBody(body);
}

export async function placeIolBuyOrder(order: IolOrderRequest): Promise<IolOrderResult> {
  return placeOrder("comprar", order);
}

export async function placeIolSellOrder(order: IolOrderRequest): Promise<IolOrderResult> {
  return placeOrder("vender", order);
}

export async function fetchIolPortfolio(): Promise<IolPortfolioItem[]> {
  const res = await iolFetch("/portafolio/bCBA");
  const data = await res.json();
  return data.activos ?? [];
}
