import "server-only";
import { NextResponse } from "next/server";

export function fail(status: number, error: string, message?: string) {
  return NextResponse.json({ error, message: message ?? error }, { status });
}

/** Maps a Postgres error raised by our functions (errcode / hint) to an HTTP response. */
export function fromDbError(err: { code?: string; hint?: string; message?: string } | null) {
  if (!err) return fail(500, "unknown");
  if (err.hint === "insufficient_coins") return fail(402, "insufficient_coins", "You don’t have enough coins for this part.");
  if (err.hint === "open_limit") return fail(429, "open_limit", "You have 5 conversions open. Finish or cancel one first.");
  if (err.hint === "bad_status") return fail(409, "bad_status", "This conversion has already moved on. Refresh the page.");
  if (err.code === "P0002") return fail(404, "not_found", "That conversion doesn’t exist.");
  if (err.code === "42501") return fail(403, "forbidden", "That file isn’t yours.");
  if (err.code === "28000") return fail(401, "signed_out", "Please sign in again.");
  console.error(err);
  return fail(500, "server", "Something went wrong on our side. Please try again.");
}
