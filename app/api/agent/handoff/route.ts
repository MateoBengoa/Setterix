import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { conversationId?: string; isAiActive?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const { conversationId, isAiActive } = body;
  if (!conversationId || typeof isAiActive !== "boolean") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { data: orgId, error: oidErr } = await supabase.rpc("get_my_org_id");
  if (oidErr || !orgId) {
    return NextResponse.json({ error: "no_org" }, { status: 403 });
  }

  const { error } = await supabase
    .from("conversations")
    .update({ is_ai_active: isAiActive })
    .eq("id", conversationId)
    .eq("organization_id", orgId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
