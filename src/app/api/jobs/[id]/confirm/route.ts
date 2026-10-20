import { NextResponse, type NextRequest } from "next/server";
import { currentUser, supabaseServer } from "@/lib/supabase/server";
import { fail, fromDbError } from "@/lib/api";
import { notifyOwner, pingEngine } from "@/lib/notify";
import { site } from "@/lib/site";

export async function POST(_request: NextRequest, ctx: RouteContext<"/api/jobs/[id]/confirm">) {
  const { id } = await ctx.params;
  const user = await currentUser();
  if (!user) return fail(401, "signed_out", "Please sign in again.");
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("confirm_job", { p_job_id: id });
  if (error) return fromDbError(error);
  await Promise.all([
    notifyOwner(`Confirmed, build it: ${data.name} (${data.tier}, ${data.coins_charged} coins) for ${user.email}\n${site.url}/admin`),
    pingEngine("job.confirmed", data.id),
  ]);
  return NextResponse.json({ job: data });
}
