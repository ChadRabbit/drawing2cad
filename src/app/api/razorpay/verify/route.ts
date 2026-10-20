import { NextResponse, type NextRequest } from "next/server";
import { currentUser, supabaseAdmin } from "@/lib/supabase/server";
import { fail } from "@/lib/api";
import { capturePayment, checkoutSignatureOk, getPayment, razorpayConfigured } from "@/lib/razorpay";

/** Called by the checkout success handler. Coins are only added for a payment Razorpay confirms is captured. */
export async function POST(request: NextRequest) {
  if (!razorpayConfigured()) return fail(503, "payments_off", "Payments aren’t switched on yet.");
  const user = await currentUser();
  if (!user) return fail(401, "signed_out", "Please sign in again.");

  const body = await request.json().catch(() => null);
  const orderId = String(body?.razorpay_order_id ?? "");
  const paymentId = String(body?.razorpay_payment_id ?? "");
  const signature = String(body?.razorpay_signature ?? "");
  if (!orderId || !paymentId || !checkoutSignatureOk(orderId, paymentId, signature)) {
    return fail(400, "signature", "We couldn’t verify that payment. If money left your account, email us and we’ll sort it out.");
  }

  const admin = supabaseAdmin();
  const { data: row } = await admin.from("payments").select("*").eq("razorpay_order_id", orderId).eq("user_id", user.id).single();
  if (!row) return fail(404, "no_order", "That order isn’t on your account.");

  try {
    let payment = await getPayment(paymentId);
    if (payment.order_id !== orderId || payment.amount !== row.amount || payment.currency !== row.currency) {
      return fail(400, "mismatch", "That payment doesn’t match the order.");
    }
    if (payment.status === "authorized") payment = await capturePayment(paymentId, row.amount, row.currency);
    if (payment.status !== "captured") return fail(402, "not_captured", "The payment hasn’t gone through yet.");
  } catch (err) {
    console.error("razorpay verify", err);
    return fail(502, "gateway", "We couldn’t reach the payment provider. Your coins will appear within a few minutes.");
  }

  const { data: credited, error } = await admin.rpc("credit_payment", { p_order_id: orderId, p_payment_id: paymentId });
  if (error) {
    console.error(error);
    return fail(500, "server", "Payment received, but adding the coins failed. We’ve been told and will fix it.");
  }
  const { data: profile } = await admin.from("profiles").select("coins").eq("id", user.id).single();
  return NextResponse.json({ coins: credited.coins, balance: profile?.coins ?? null });
}
