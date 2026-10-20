import "server-only";
import { currentUser, isAdmin, supabaseAdmin } from "./supabase/server";
import { fail } from "./api";

/** Returns the service-role client when the caller is the owner, or an error response. */
export async function requireAdmin() {
  const user = await currentUser();
  if (!user) return { error: fail(401, "signed_out", "Please sign in again.") } as const;
  if (!(await isAdmin())) return { error: fail(403, "forbidden", "Owner only.") } as const;
  return { admin: supabaseAdmin(), user } as const;
}
