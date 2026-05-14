import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const client = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const { messages, context } = await request.json();

    const indicatorsList = context.indicators?.join(", ") || "ninguno";
    const system = `Eres un asistente de trading especializado en el mercado argentino (BYMA) y criptomonedas.

Contexto actual del gráfico:
- Símbolo: ${context.symbol}
- Precio: ${context.price}
- Variación: ${context.pct}%
- Mercado: ${context.market === "argentina" ? "BYMA (Argentina)" : "Crypto (Binance)"}
- Indicadores activos: ${indicatorsList}
${context.candles ? `- Últimas velas: ${context.candles}` : ""}

Puedes analizar el gráfico, comentar sobre tendencias, sugerir indicadores y niveles clave.
Sé conciso (máximo 3 párrafos). Usa español argentino. Agrega disclaimer breve si das recomendaciones operativas.
No uses markdown complejo, solo texto plano con saltos de línea.`;

    const stream = await client.messages.stream({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
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
