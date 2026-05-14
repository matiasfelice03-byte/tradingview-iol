import { getSupabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

async function sendTelegram(token: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

async function getIolToken(username: string, password: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.invertironline.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username, password, grant_type: "password" }),
    });
    const data = await res.json();
    return data.access_token ?? null;
  } catch { return null; }
}

async function getArgentinaPrice(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.invertironline.com/api/v2/bCBA/Titulos/${symbol}/Cotizacion`,
      { headers: { Authorization: "Bearer public" } }
    );
    if (!res.ok) {
      // Try Yahoo Finance as fallback
      const yRes = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.BA?interval=1d&range=1d`
      );
      const yData = await yRes.json();
      const price = yData?.chart?.result?.[0]?.meta?.regularMarketPrice;
      return price ?? null;
    }
    const data = await res.json();
    return data?.ultimoPrecio ?? null;
  } catch { return null; }
}

async function getCryptoPrice(symbol: string): Promise<number | null> {
  try {
    const pair = symbol.endsWith("USDT") ? symbol : symbol + "USDT";
    const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pair}`);
    const data = await res.json();
    return data?.price ? parseFloat(data.price) : null;
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  // Verify cron secret
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!tgToken) return NextResponse.json({ error: "No telegram token" }, { status: 500 });

  // Get telegram chat id
  const { data: settingsRow } = await getSupabase()
    .from("settings")
    .select("value")
    .eq("key", "telegram_chat_id")
    .single();
  const chatId = settingsRow?.value;

  // Get all active, non-triggered alerts
  const { data: alerts, error } = await getSupabase()
    .from("alerts")
    .select("*")
    .eq("active", true)
    .eq("triggered", false);

  if (error || !alerts?.length) return NextResponse.json({ checked: 0 });

  let triggered = 0;

  for (const alert of alerts) {
    const price = alert.market === "argentina"
      ? await getArgentinaPrice(alert.symbol)
      : await getCryptoPrice(alert.symbol);

    if (price === null) continue;

    const condition = alert.direction === "above"
      ? price >= alert.target_price
      : price <= alert.target_price;

    if (!condition) continue;

    // Mark as triggered
    await getSupabase().from("alerts").update({ triggered: true, active: false }).eq("id", alert.id);
    triggered++;

    // Send Telegram notification
    const alertChatId = alert.telegram_chat_id || chatId;
    if (alertChatId && tgToken) {
      const dir = alert.direction === "above" ? "superó ↑" : "bajó de ↓";
      const msg = `🔔 <b>Alerta: ${alert.symbol}</b>\n`
        + `Precio actual: <b>${price.toLocaleString("es-AR")}</b>\n`
        + `Condición: ${dir} ${alert.target_price.toLocaleString("es-AR")}\n`
        + (alert.message ? `📝 ${alert.message}` : "");
      await sendTelegram(tgToken, alertChatId, msg);
    }

    // Execute IOL order if configured
    if (alert.action && alert.market === "argentina" && alert.iol_username && alert.iol_password) {
      const token = await getIolToken(alert.iol_username, alert.iol_password);
      if (token) {
        const endpoint = alert.action.type === "buy"
          ? "https://api.invertironline.com/api/v2/operar/Comprar"
          : "https://api.invertironline.com/api/v2/operar/Vender";
        try {
          const orderRes = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              mercado: "bCBA",
              simbolo: alert.symbol,
              cantidad: alert.action.quantity,
              precio: price,
              plazo: alert.action.plazo,
              tipoOrden: alert.action.orderType,
            }),
          });
          const orderData = await orderRes.json();
          if (alertChatId && tgToken) {
            const ok = orderRes.ok;
            await sendTelegram(tgToken, alertChatId,
              ok
                ? `✅ Orden ejecutada: ${alert.action.type === "buy" ? "Compra" : "Venta"} ${alert.action.quantity} ${alert.symbol} @ ${price}`
                : `❌ Error en orden: ${JSON.stringify(orderData).slice(0, 200)}`
            );
          }
        } catch (e) {
          console.error("Order error", e);
        }
      }
    }
  }

  return NextResponse.json({ checked: alerts.length, triggered });
}
