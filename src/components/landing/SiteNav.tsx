"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Caveat } from "next/font/google";
import Mark from "./Mark";
import { supabaseBrowser } from "@/lib/supabase/client";
import { site } from "@/lib/site";
import "./nav.css";

const hand = Caveat({ subsets: ["latin"], weight: ["600"], display: "swap" });

export type Who = { name: string; coins: number; isAdmin?: boolean };

export function firstName(fullName: string | null | undefined, email: string | null | undefined) {
  return (fullName ?? "").split(" ")[0] || (email ?? "").split("@")[0];
}

/** "unknown" until the session is read, so a signed-in visitor never sees "Sign in" flash first. */
function useWho() {
  const [who, setWho] = useState<Who | null | "unknown">("unknown");
  useEffect(() => {
    const supabase = supabaseBrowser();
    let live = true;
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        if (live) setWho(null);
        return;
      }
      const { data: p } = await supabase.from("profiles").select("full_name, email, coins").eq("id", user.id).single();
      const name = firstName((p?.full_name as string | null) ?? (user.user_metadata?.full_name as string | undefined), p?.email ?? user.email);
      if (live) setWho({ name, coins: (p?.coins as number | undefined) ?? 0 });
    };
    load();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") load();
    });
    return () => {
      live = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return who;
}

/** The bar outside the app (landing and legal pages): reads the session itself. */
export default function SiteNav({ inApp = false }: { inApp?: boolean }) {
  return <NavBar who={useWho()} inApp={inApp} />;
}

/** One bar for the whole site. Over the hero on the landing page, sticky at the top inside the app. */
export function NavBar({ who, inApp = false }: { who: Who | null | "unknown"; inApp?: boolean }) {
  const pathname = usePathname();
  const signedIn = who !== null && who !== "unknown";
  const current = (href: string) => (pathname === href || (href === "/history" && pathname.startsWith("/models")) ? "page" : undefined);

  return (
    <header className={["nav", inApp && "nav--app", signedIn && "nav--in"].filter(Boolean).join(" ")}>
      <Link href="/" className="nav__brand" aria-label={`${site.name} home`}>
        <Mark />
        <span>{site.name}</span>
      </Link>
      {signedIn && (
        <p className={`nav__hello ${hand.className}`} aria-label={`Signed in as ${who.name}`}>
          <span aria-hidden="true">{who.name}</span>
        </p>
      )}
      <nav className="nav__links" aria-label="Main" data-ready={who !== "unknown" ? "true" : "false"}>
        {signedIn ? (
          <>
            {who.isAdmin && (
              <Link href="/admin" className="link nav__hide-s" aria-current={current("/admin")}>
                Owner
              </Link>
            )}
            <Link href="/history" className="link" aria-current={current("/history")}>
              History
            </Link>
            <Link href="/coins" className="link" aria-current={current("/coins")}>
              <span className="tabular">{who.coins}</span> coins
            </Link>
            <form action="/auth/signout" method="post" className="nav__out">
              <button type="submit" className="link">
                Sign out
              </button>
            </form>
          </>
        ) : (
          <>
            <Link href="/#demo" className="link nav__hide-s">
              Demo
            </Link>
            <Link href="/#pricing" className="link nav__hide-s">
              Pricing
            </Link>
            <Link href="/#questions" className="link nav__hide-s">
              Questions
            </Link>
            <Link href="/login?next=/" className="link">
              Sign in
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
