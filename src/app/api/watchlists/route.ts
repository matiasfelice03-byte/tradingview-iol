import { getSupabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

// GET /api/watchlists?user=<iol_username> — returns saved custom watchlists
export async function GET(req: NextRequest) {
  const user = req.nextUrl.searchParams.get("user");
  if (!user) return NextResponse.json({ error: "missing user" }, { status: 400 });

  const { data, error } = await getSupabase()
    .from("user_watchlists")
    .select("data, updated_at")
    .eq("iol_username", user)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    watchlists: data?.data ?? [],
    updatedAt: data?.updated_at ?? null,
  });
}

// PUT /api/watchlists — upsert custom watchlists for an IOL account
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const user: string | undefined = body?.user;
  const watchlists = body?.watchlists;
  if (!user || !Array.isArray(watchlists)) {
    return NextResponse.json({ error: "missing user or watchlists" }, { status: 400 });
  }

  const { error } = await getSupabase()
    .from("user_watchlists")
    .upsert(
      { iol_username: user, data: watchlists, updated_at: new Date().toISOString() },
      { onConflict: "iol_username" },
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
