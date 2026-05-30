import { getSupabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

const SQL = `
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  market text NOT NULL,
  direction text NOT NULL,
  target_price numeric NOT NULL,
  message text DEFAULT '',
  active boolean DEFAULT true,
  triggered boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  action jsonb,
  telegram_chat_id text,
  iol_username text,
  iol_password text
);

CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value text NOT NULL
);

CREATE TABLE IF NOT EXISTS user_watchlists (
  iol_username text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz DEFAULT now()
);
`;

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Run each statement
  const statements = SQL.trim().split(";").map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    const { error } = await getSupabase().rpc("exec_sql", { sql: stmt });
    if (error) {
      // Try raw REST if rpc not available
      const res = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/`,
        { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}` } }
      );
      return NextResponse.json({ note: "Use Supabase SQL editor to run migrations", sql: SQL, rpcError: error.message });
    }
  }

  return NextResponse.json({ ok: true });
}
