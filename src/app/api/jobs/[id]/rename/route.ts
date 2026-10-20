import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { fail, fromDbError } from "@/lib/api";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/jobs/[id]/rename">) {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return fail(400, "name", "Give the part a name.");
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("rename_job", { p_job_id: id, p_name: name });
  if (error) return fromDbError(error);
  return NextResponse.json({ job: data });
}
