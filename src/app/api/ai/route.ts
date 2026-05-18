import Groq from "groq-sdk";
import { NextRequest } from "next/server";

const client = new Groq({ apiKey: process.env.GROQ_API_KEY ?? "placeholder" });

export async function POST(request: NextRequest) {
  try {
    const { messages, context } = await request.json();

    const indicatorsList = context.indicators?.join(", ") || "ninguno";
    const system = `Sos un analista de trading profesional con profundo conocimiento en análisis técnico y el mercado argentino (BYMA/CEDEARs) y criptomonedas.

CONTEXTO DEL GRÁFICO ACTUAL:
- Símbolo: ${context.symbol}
- Precio actual: ${context.price}
- Variación del día: ${context.pct}%
- Mercado: ${context.market === "argentina" ? "BYMA (Argentina)" : "Crypto (Binance)"}
- Indicadores visibles: ${indicatorsList || "ninguno"}
${context.candles ? `- Últimas 10 velas (OHLC):\n${context.candles}` : ""}

INSTRUCCIONES DE ANÁLISIS:
- Identificá tendencia actual, niveles clave de soporte/resistencia, y señales de los indicadores activos
- Usá español argentino informal (vos, che, etc.)
- Sé directo y concreto, máximo 4 párrafos
- Si das una recomendación operativa, cerrá con: "Recordá que esto no es asesoramiento financiero."
- No uses markdown complejo, solo texto plano con saltos de línea

ACCIONES EN EL GRÁFICO:
Podés interactuar con el gráfico marcando niveles. Si el usuario te pide que marques algo, que agregues indicadores, o si tu análisis identifica niveles clave importantes, incluí AL FINAL de tu respuesta (después de todo el texto) un bloque exactamente así:

[ACTIONS]
{"actions":[...]}
[/ACTIONS]

Acciones disponibles:
- {"type":"add_hline","price":1234.5,"label":"Soporte","color":"#26a69a"} — agrega línea horizontal
- {"type":"add_price_range","high":1300,"low":1200,"label":"Zona de soporte","color":"#26a69a"} — agrega zona/rango
- {"type":"enable_indicator","name":"ema200"} — activa indicador (ema20, ema50, ema200, rsi, macd, volume)
- {"type":"disable_indicator","name":"rsi"} — desactiva indicador

Reglas para acciones:
- Solo usá colores: verde=#26a69a (soporte/alcista), rojo=#ef5350 (resistencia/bajista), azul=#2962ff (neutro), amarillo=#ffb74d
- No incluyas el bloque [ACTIONS] si no hay ninguna acción útil que tomar
- Siempre usá precios del contexto actual del gráfico para las líneas`;

    const stream = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 800,
      stream: true,
      messages: [
        { role: "system", content: system },
        ...messages.map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content ?? "";
            if (text) controller.enqueue(encoder.encode(text));
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
