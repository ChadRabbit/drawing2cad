"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import Mark from "@/components/landing/Mark";
import { supabaseBrowser } from "@/lib/supabase/client";
import { safeNext } from "@/lib/safe-next";
import { site } from "@/lib/site";

export default function LoginPanel() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const failed = params.get("error") === "1";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(failed ? "Sign-in didn’t finish. Please try again." : null);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      setBusy(false);
      setError("Google sign-in isn’t available right now. Please try again in a minute.");
    }
  };

  return (
    <div className="login__panel">
      <Link href="/" className="login__brand" aria-label={`${site.name} home`}>
        <Mark size={32} />
        <span>{site.name}</span>
      </Link>
      <h1 className="login__title">{next === "/" ? "Sign in" : "Sign in to convert"}</h1>
      <p className="login__lede">
        Use your Google account. New accounts get {site.signupCoins} coins, enough for one Simple part.
      </p>
      <button type="button" className="btn btn-paper login__google" onClick={signIn} disabled={busy}>
        <GoogleG />
        {busy ? "Opening Google…" : "Continue with Google"}
      </button>
      {error && (
        <p className="login__error" role="alert">
          {error}
        </p>
      )}
      <p className="login__legal">
        By continuing you agree to the{" "}
        <Link className="link link-under" href="/terms">
          Terms
        </Link>{" "}
        and the{" "}
        <Link className="link link-under" href="/privacy">
          Privacy policy
        </Link>
        .
      </p>
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
