import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

// Local testing only: signs in a test user made with the admin API (Google sign-in can't run on localhost
// without OAuth credentials). Returns 404 unless running `next dev` with DEV_LOGIN=1.
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development" || process.env.DEV_LOGIN !== "1") {
    return new NextResponse("Not found", { status: 404 });
  }
  const email = request.nextUrl.searchParams.get("email") ?? "";
  const password = request.nextUrl.searchParams.get("password") ?? "";
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return new NextResponse(error.message, { status: 401 });
  return NextResponse.redirect(new URL(safeNext(request.nextUrl.searchParams.get("next")), request.url));
}
