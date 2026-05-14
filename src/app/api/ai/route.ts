import Groq from "groq-sdk";
import { NextRequest } from "next/server";

const client = new Groq({ apiKey: process.env.GROQ_API_KEY ?? "placeholder" });

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

Podés analizar el gráfico, comentar tendencias, sugerir indicadores y niveles clave.
Sé conciso (máximo 3 párrafos). Usá español argentino. Agregá disclaimer breve si das recomendaciones operativas.
No uses markdown complejo, solo texto plano con saltos de línea.`;

    const stream = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 600,
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
