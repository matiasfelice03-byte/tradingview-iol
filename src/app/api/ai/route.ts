import Groq from "groq-sdk";
import { NextRequest } from "next/server";

const client = new Groq({ apiKey: process.env.GROQ_API_KEY ?? "placeholder" });

export async function POST(request: NextRequest) {
  try {
    const { messages, context } = await request.json();

    const indicatorsList = context.indicators?.join(", ") || "ninguno";
    const system = `Sos un analista de trading profesional con profundo conocimiento en:
- Análisis técnico: patrones de velas (doji, martillo, engulfing, etc.), figuras chartistas (H&S, triángulos, canales, cuñas, flags), soportes y resistencias, líneas de tendencia
- Indicadores técnicos: medias móviles (EMA/SMA), RSI, MACD, Bandas de Bollinger, Volumen, ATR, Estocástico, Fibonacci
- Análisis fundamental: valuación de empresas, ratios financieros (P/E, EV/EBITDA), contexto macro, dividendos
- Mercado argentino (BYMA): acciones locales, CEDEARs, bonos, contexto económico argentino, tipo de cambio, inflación
- Criptomonedas: Bitcoin, altcoins, DeFi, correlaciones, ciclos de mercado

CONTEXTO DEL GRÁFICO ACTUAL:
- Símbolo: ${context.symbol}
- Precio actual: ${context.price}
- Variación del día: ${context.pct}%
- Mercado: ${context.market === "argentina" ? "BYMA (Argentina)" : "Crypto (Binance)"}
- Indicadores visibles: ${indicatorsList || "ninguno"}
${context.candles ? `- Últimas 10 velas (OHLC diario):\n${context.candles}` : ""}

INSTRUCCIONES:
- Analizá siempre el gráfico en base al contexto que tenés antes de responder cualquier pregunta
- Identificá tendencia actual (alcista/bajista/lateral), niveles clave de soporte y resistencia, y señales de los indicadores activos
- Si el usuario pregunta algo genérico, interpretalo en función del activo que está viendo
- Cuando hagas análisis, estructuralo en: Tendencia → Niveles clave → Señales técnicas → Conclusión operativa
- Usá español argentino informal (vos, che, etc.)
- Sé directo y concreto, máximo 4 párrafos
- Si das una recomendación operativa, cerrá con: "Recordá que esto no es asesoramiento financiero."
- No uses markdown complejo, solo texto plano con saltos de línea`;

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
