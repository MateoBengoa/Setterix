import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.DODO_WEBHOOK_SECRET;
  const sig =
    req.headers.get("x-dodo-signature") ?? req.headers.get("dodo-signature");
  if (secret && sig !== secret) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let payload: {
    type?: string;
    data?: {
      organization_id?: string;
      customer_id?: string;
      subscription_id?: string;
      plan?: string;
    };
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const supabase = createAdminClient();
  const orgId = payload.data?.organization_id;
  if (!orgId) return NextResponse.json({ ok: true });

  const type = payload.type ?? "";

  if (type.includes("payment.succeeded") || type === "invoice.paid") {
    await supabase
      .from("organizations")
      .update({
        plan: payload.data?.plan ?? "starter",
        dodo_customer_id: payload.data?.customer_id ?? null,
        dodo_subscription_id: payload.data?.subscription_id ?? null,
      })
      .eq("id", orgId);
  }

  if (
    type.includes("subscription.cancelled") ||
    type === "subscription.canceled"
  ) {
    await supabase
      .from("organizations")
      .update({
        plan: "trial",
        trial_ends_at: new Date(Date.now() + 7 * 864e5).toISOString(),
        dodo_subscription_id: null,
      })
      .eq("id", orgId);
  }

  return NextResponse.json({ received: true });
}
