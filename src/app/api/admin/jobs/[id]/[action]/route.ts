import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { fail } from "@/lib/api";
import { BUILD_STAGES } from "@/lib/jobs";

/**
 * Owner actions on a job. These call the same service-role functions the conversion engine will use, so the
 * owner panel is a manual stand-in for the engine:
 *   drawing   → signed URL of the customer's drawing
 *   quote     → { tier, note }        estimating → quoted
 *   start     →                       queued → processing
 *   progress  → { progress, stage }
 *   upload    →                       signed upload URLs for model.step / model.glb / thumb.webp
 *   complete  → { result, glb, thumb } processing → done
 *   fail      → { error }             any open state → failed, coins kept
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/admin/jobs/[id]/[action]">) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const { admin } = gate;
  const { id, action } = await ctx.params;
  const body = await request.json().catch(() => ({}));

  const { data: job } = await admin.from("jobs").select("id,user_id,status,source_path").eq("id", id).single();
  if (!job) return fail(404, "not_found", "No such job.");
  const base = `${job.user_id}/${job.id}`;

  switch (action) {
    case "drawing": {
      const { data } = await admin.storage.from("drawings").createSignedUrl(job.source_path, 3600);
      return NextResponse.json({ url: data?.signedUrl ?? null });
    }
    case "quote": {
      const { data, error } = await admin.rpc("engine_quote_job", { p_job_id: id, p_tier: body.tier, p_note: body.note || null });
      if (error) return fail(400, "quote", error.message);
      return NextResponse.json({ job: data });
    }
    case "start": {
      const { data, error } = await admin.rpc("engine_progress", { p_job_id: id, p_progress: 5, p_stage: BUILD_STAGES[0] });
      if (error) return fail(400, "start", error.message);
      return NextResponse.json({ job: data });
    }
    case "progress": {
      const { data, error } = await admin.rpc("engine_progress", { p_job_id: id, p_progress: Number(body.progress) || 0, p_stage: String(body.stage ?? "") });
      if (error) return fail(400, "progress", error.message);
      return NextResponse.json({ job: data });
    }
    case "upload": {
      const names = ["model.step", "model.glb", "thumb.webp"];
      const urls: Record<string, string> = {};
      for (const n of names) {
        const { data, error } = await admin.storage.from("models").createSignedUploadUrl(`${base}/${n}`, { upsert: true });
        if (error || !data) return fail(500, "upload", error?.message ?? "Could not sign the upload.");
        urls[n] = data.signedUrl;
      }
      return NextResponse.json({ urls });
    }
    case "complete": {
      const { data, error } = await admin.rpc("engine_complete_job", {
        p_job_id: id,
        p_step_path: `${base}/model.step`,
        p_glb_path: body.glb ? `${base}/model.glb` : null,
        p_thumb_path: body.thumb ? `${base}/thumb.webp` : null,
        p_result: body.result ?? {},
      });
      if (error) return fail(400, "complete", error.message);
      return NextResponse.json({ job: data });
    }
    case "fail": {
      const reason = String(body.error ?? "").trim();
      if (!reason) return fail(400, "reason", "Say why, so the customer knows what to fix.");
      const { data, error } = await admin.rpc("engine_fail_job", { p_job_id: id, p_error: reason });
      if (error) return fail(400, "fail", error.message);
      return NextResponse.json({ job: data });
    }
    default:
      return fail(404, "unknown_action", "Unknown action.");
  }
}
