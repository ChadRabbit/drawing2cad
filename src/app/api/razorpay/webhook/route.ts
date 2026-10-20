import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { webhookSignatureOk } from "@/lib/razorpay";

type Event = {
  event: string;
  payload: { payment?: { entity: { id: string; order_id: string; status: string } } };
};

/**
 * Razorpay webhook (Dashboard → Webhooks → https://<site>/api/razorpay/webhook, events payment.captured and
 * payment.failed). A backup for when the buyer closes the tab before the checkout handler runs.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  if (!webhookSignatureOk(raw, signature)) return new NextResponse("bad signature", { status: 400 });

  const evt = JSON.parse(raw) as Event;
  const payment = evt.payload.payment?.entity;
  if (!payment?.order_id) return NextResponse.json({ ok: true });

  const admin = supabaseAdmin();
  if (evt.event === "payment.captured" || evt.event === "order.paid") {
    const { error } = await admin.rpc("credit_payment", { p_order_id: payment.order_id, p_payment_id: payment.id });
    // an order we don't know is not ours to credit; acknowledge so Razorpay stops retrying
    if (error && !String(error.message).includes("unknown order")) {
      console.error("webhook credit", error);
      return new NextResponse("retry", { status: 500 });
    }
  } else if (evt.event === "payment.failed") {
    await admin.from("payments").update({ status: "failed" }).eq("razorpay_order_id", payment.order_id).eq("status", "created");
  }
  return NextResponse.json({ ok: true });
}
