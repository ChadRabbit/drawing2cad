"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

type Account = {
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
};

const AccountContext = createContext<Account | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const supabase = supabaseBrowser();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    const [{ data: p }, { data: admin }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.rpc("is_admin"),
    ]);
    setProfile((p as Profile) ?? null);
    setIsAdmin(admin === true);
    setLoading(false);
  }, [router, pathname]);

  useEffect(() => {
    refresh();
    const { data } = supabaseBrowser().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/");
    });
    return () => data.subscription.unsubscribe();
    // only on mount: navigation inside the app keeps the same account
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => ({ profile, isAdmin, loading, refresh }), [profile, isAdmin, loading, refresh]);
  return <AccountContext value={value}>{children}</AccountContext>;
}

export function useAccount() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccount must be used inside AccountProvider");
  return ctx;
}
