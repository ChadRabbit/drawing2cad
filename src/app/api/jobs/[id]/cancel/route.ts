import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { fromDbError } from "@/lib/api";

export async function POST(_request: NextRequest, ctx: RouteContext<"/api/jobs/[id]/cancel">) {
  const { id } = await ctx.params;
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("cancel_job", { p_job_id: id });
  if (error) return fromDbError(error);
  return NextResponse.json({ job: data });
}
