import { getSupabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const { data, error } = await getSupabase()
    .from("alerts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, error } = await getSupabase().from("alerts").insert([body]).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
