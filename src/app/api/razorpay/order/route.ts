import { NextResponse, type NextRequest } from "next/server";
import { currentUser, supabaseAdmin } from "@/lib/supabase/server";
import { fail } from "@/lib/api";
import { createOrder, razorpayConfigured } from "@/lib/razorpay";
import { site } from "@/lib/site";

export async function POST(request: NextRequest) {
  if (!razorpayConfigured()) return fail(503, "payments_off", "Payments aren’t switched on yet.");
  const user = await currentUser();
  if (!user) return fail(401, "signed_out", "Please sign in again.");

  const body = await request.json().catch(() => null);
  const currency = body?.currency === "USD" ? "USD" : "INR";
  const admin = supabaseAdmin();
  const { data: pack } = await admin.from("coin_packs").select("*").eq("id", String(body?.packId ?? "")).eq("active", true).single();
  if (!pack) return fail(404, "no_pack", "That pack isn’t available.");

  const amount = currency === "INR" ? pack.price_inr : pack.price_usd;
  try {
    const order = await createOrder(amount, currency, `d2c_${Date.now()}`, { user_id: user.id, pack_id: pack.id, coins: String(pack.coins) });
    const { error } = await admin.from("payments").insert({
      user_id: user.id,
      pack_id: pack.id,
      coins: pack.coins,
      amount,
      currency,
      razorpay_order_id: order.id,
    });
    if (error) throw error;
    return NextResponse.json({
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount,
      currency,
      name: site.name,
      description: `${pack.coins} coins`,
      email: user.email,
      fullName: (user.user_metadata?.full_name as string | undefined) ?? "",
    });
  } catch (err) {
    console.error("razorpay order", err);
    return fail(502, "gateway", "The payment page couldn’t be opened. Please try again.");
  }
}
