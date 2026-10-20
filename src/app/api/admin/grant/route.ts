import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { fail } from "@/lib/api";

export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const coins = Math.trunc(Number(body.coins));
  if (!email || !Number.isFinite(coins) || coins === 0) return fail(400, "input", "Give an email and a number of coins.");
  const { data: profile } = await gate.admin.from("profiles").select("id").ilike("email", email).maybeSingle();
  if (!profile) return fail(404, "no_user", "No account with that email. They need to sign in once first.");
  const { data, error } = await gate.admin.rpc("grant_coins", { p_user_id: profile.id, p_coins: coins, p_note: String(body.note ?? "").slice(0, 200) || null });
  if (error) return fail(400, "grant", error.message);
  return NextResponse.json({ balance: data });
}
