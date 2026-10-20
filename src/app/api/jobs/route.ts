import { NextResponse, type NextRequest } from "next/server";
import { currentUser, supabaseServer } from "@/lib/supabase/server";
import { fail, fromDbError } from "@/lib/api";
import { acceptedFiles, site } from "@/lib/site";
import { notifyOwner, pingEngine } from "@/lib/notify";

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) return fail(401, "signed_out", "Please sign in again.");

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";
  const path = typeof body?.path === "string" ? body.path : "";
  const bytes = Number(body?.bytes);
  const units = ["auto", "mm", "inch"].includes(body?.units) ? body.units : "auto";
  const notes = typeof body?.notes === "string" ? body.notes.slice(0, 1000) : null;
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const kind = acceptedFiles[ext as keyof typeof acceptedFiles];

  if (!name) return fail(400, "name", "Give the part a name.");
  if (!kind) return fail(400, "type", "That file type isn’t supported. Use PDF, PNG, JPG, WEBP, DWG or DXF.");
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > site.maxUploadMB * 1024 * 1024) {
    return fail(400, "size", `Files can be up to ${site.maxUploadMB} MB.`);
  }

  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("create_job", {
    p_name: name,
    p_source_path: path,
    p_source_kind: kind,
    p_source_bytes: Math.round(bytes),
    p_units: units,
    p_notes: notes,
  });
  if (error) return fromDbError(error);

  await Promise.all([
    notifyOwner(`New drawing to price: ${name} (${kind.toUpperCase()}) from ${user.email}\n${site.url}/admin`),
    pingEngine("job.created", data.id),
  ]);
  return NextResponse.json({ job: data });
}
