import { getSupabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

// Call this to get the chat_id from the last message sent to the bot
export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return NextResponse.json({ error: "No bot token" }, { status: 500 });

  const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=1&offset=-1`);
  const data = await res.json();

  const chatId = data?.result?.[0]?.message?.chat?.id;
  if (!chatId) {
    return NextResponse.json({ error: "No messages found. Send a message to the bot first." }, { status: 404 });
  }

  // Save to settings
  await getSupabase().from("settings").upsert({ key: "telegram_chat_id", value: String(chatId) });

  return NextResponse.json({ ok: true, chatId });
}
