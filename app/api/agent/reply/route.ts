import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAgentReply } from "@/lib/ai/agent";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (
    !process.env.INTERNAL_AGENT_SECRET ||
    auth !== `Bearer ${process.env.INTERNAL_AGENT_SECRET}`
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { conversationId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const conversationId = body.conversationId;
  if (!conversationId) {
    return NextResponse.json({ error: "missing_conversationId" }, { status: 400 });
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "no_gemini" }, { status: 500 });
  }

  const supabase = createAdminClient();
  const result = await generateAgentReply(conversationId, {
    supabase,
    geminiApiKey: key,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
