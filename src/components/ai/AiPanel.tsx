"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, X, Send, Loader2, ChevronDown, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChartContext {
  symbol: string;
  price: string;
  pct: string;
  market: string;
  indicators: string[];
  candles?: string;
}

interface Props {
  context: ChartContext;
}

const SUGGESTIONS = [
  "Analizá el gráfico y decime si está en tendencia",
  "¿Cuáles son los soportes y resistencias clave?",
  "¿Qué dicen los indicadores activos?",
  "¿Hay algún patrón de velas o figura chartista?",
];

type PanelSize = "small" | "medium" | "large";

const SIZES: Record<PanelSize, { h: number; w: number }> = {
  small:  { h: 260, w: 260 },
  medium: { h: 420, w: 320 },
  large:  { h: 600, w: 420 },
};

export function AiPanel({ context }: Props) {
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState<PanelSize>("medium");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || streaming) return;
    const userMsg: Message = { role: "user", content: text.trim() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setStreaming(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, context }),
      });
      if (!res.ok || !res.body) throw new Error("Error al conectar con la IA");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: accumulated };
          return updated;
        });
      }
    } catch (e) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: `Error: ${e instanceof Error ? e.message : "No se pudo conectar"}`,
        };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const cycleSize = () => {
    setSize((s) => s === "small" ? "medium" : s === "medium" ? "large" : "small");
  };

  const { h, w } = SIZES[size];

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "pointer-events-auto absolute bottom-14 right-3 z-30 flex h-9 items-center gap-1.5 rounded-full px-3 shadow-lg transition-all",
          open
            ? "bg-tv-blue text-white"
            : "bg-tv-panel border border-tv-border text-tv-text-muted hover:text-tv-blue hover:border-tv-blue",
        )}
        title="Asistente IA"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
        <span className="text-[11px] font-semibold">IA</span>
      </button>

      {/* Panel */}
      {open && (
        <div
          className="pointer-events-auto absolute bottom-0 right-0 z-40 flex flex-col rounded-tl-xl border-l border-t border-tv-border bg-tv-panel shadow-2xl transition-all duration-150"
          style={{ height: h, width: w }}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-tv-border px-3 py-2">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-tv-blue" />
              <span className="text-[12px] font-semibold text-tv-text">Llama 3.3</span>
              <span className="rounded bg-tv-blue/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-tv-blue">
                Beta
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  className="rounded px-1.5 py-0.5 text-[10px] text-tv-text-muted hover:text-tv-text"
                >
                  Limpiar
                </button>
              )}
              <button
                onClick={cycleSize}
                className="rounded p-1 text-tv-text-muted hover:text-tv-text"
                title={size === "large" ? "Achicar" : "Agrandar"}
              >
                {size === "large" ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded p-1 text-tv-text-muted hover:text-tv-red"
                title="Cerrar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Context chip */}
          <div className="flex shrink-0 items-center gap-1.5 border-b border-tv-border px-3 py-1.5 text-[10px] text-tv-text-muted">
            <span className="font-medium text-tv-text">{context.symbol}</span>
            <span>·</span>
            <span>{context.price}</span>
            <span className={context.pct.startsWith("-") ? "text-tv-red" : "text-tv-green"}>
              {context.pct}%
            </span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-[11px] text-tv-text-muted text-center mt-2">
                  Preguntame sobre el gráfico de {context.symbol}
                </p>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="w-full rounded border border-tv-border px-2.5 py-1.5 text-left text-[11px] text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-2.5 py-1.5 text-[11px] leading-relaxed whitespace-pre-wrap",
                    m.role === "user" ? "bg-tv-blue/20 text-tv-text" : "bg-tv-bg text-tv-text",
                  )}
                >
                  {m.content}
                  {m.role === "assistant" && streaming && i === messages.length - 1 && (
                    <span className="inline-block h-3 w-0.5 bg-tv-blue ml-0.5 animate-pulse" />
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-tv-border p-2 flex items-center gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Preguntá algo..."
              disabled={streaming}
              className="flex-1 rounded bg-tv-bg border border-tv-border px-2.5 py-1.5 text-[11px] text-tv-text placeholder:text-tv-text-muted focus:outline-none focus:border-tv-blue disabled:opacity-50"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || streaming}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-tv-blue text-white disabled:opacity-40 hover:bg-tv-blue/80"
            >
              {streaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
