"use client";

import { NavBar, firstName } from "@/components/landing/SiteNav";
import { useAccount } from "./AccountProvider";

/** The site's bar inside the app, fed by the account so the coin balance updates after each purchase or conversion. */
export default function AppNav() {
  const { profile, isAdmin, loading } = useAccount();
  const who = loading || !profile ? "unknown" : { name: firstName(profile.full_name, profile.email), coins: profile.coins, isAdmin };
  return <NavBar who={who} inApp />;
}
