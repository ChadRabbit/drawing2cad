import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

export async function GET() {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const { admin } = gate;
  const [users, done, paid] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("jobs").select("id", { count: "exact", head: true }).eq("status", "done"),
    admin.from("payments").select("amount,currency").eq("status", "paid"),
  ]);
  const revenue = { INR: 0, USD: 0 } as Record<"INR" | "USD", number>;
  for (const p of paid.data ?? []) revenue[p.currency as "INR" | "USD"] += p.amount;
  return NextResponse.json({ users: users.count ?? 0, done: done.count ?? 0, revenue });
}
