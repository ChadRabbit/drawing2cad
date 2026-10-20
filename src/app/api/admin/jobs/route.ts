import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin";

export async function GET(request: NextRequest) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const scope = request.nextUrl.searchParams.get("scope") ?? "open";
  let q = gate.admin.from("jobs").select("*, profiles(email, full_name, coins)").order("created_at", { ascending: scope === "open" });
  q = scope === "open" ? q.in("status", ["estimating", "quoted", "queued", "processing"]) : q.in("status", ["done", "failed", "cancelled"]).limit(30);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: data });
}
