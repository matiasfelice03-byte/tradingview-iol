import { NextRequest, NextResponse } from "next/server";

const IOL_BASE = "https://api.invertironline.com/api/v2";

export async function POST(request: NextRequest) {
  try {
    const { action, token, order } = await request.json() as {
      action: "comprar" | "vender";
      token: string;
      order: Record<string, unknown>;
    };

    if (!token) {
      return NextResponse.json({ error: "No hay token de autenticación" }, { status: 401 });
    }
    if (!action || !order) {
      return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
    }

    const path = action === "comprar" ? "Comprar" : "Vender";
    const iolRes = await fetch(`${IOL_BASE}/operar/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(order),
    });

    let body: unknown;
    const contentType = iolRes.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      body = await iolRes.json();
    } else {
      body = await iolRes.text();
    }

    if (!iolRes.ok) {
      let detail =
        typeof body === "object" && body !== null
          ? ((body as Record<string, string>).message ?? (body as Record<string, string>).Message ?? (body as Record<string, string>).error ?? JSON.stringify(body))
          : String(body ?? "");
      // If detail is empty or just '{}', fall back to raw body string
      if (!detail || detail === "{}") detail = "";
      console.error("[orders] IOL error", iolRes.status, "body:", body, "order:", order);
      const hint =
        iolRes.status === 500
          ? ` (${detail || "sin detalle"} — intentá con Precio de Mercado o cambiá el plazo)`
          : iolRes.status === 401
          ? " (sesión expirada — volvé a iniciar sesión)"
          : detail ? `: ${detail}` : "";
      return NextResponse.json(
        { error: `IOL ${iolRes.status}${hint}` },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, data: body });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
