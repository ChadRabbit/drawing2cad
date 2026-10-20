import "server-only";
import { cacheLife } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { fallbackPacks, fallbackTiers, type CoinPack, type Tier } from "./pricing";

export async function getPricing(): Promise<{ tiers: Tier[]; packs: CoinPack[] }> {
  "use cache";
  cacheLife("hours");
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false },
    });
    const [tiers, packs] = await Promise.all([
      sb.from("tiers").select("id,name,coins,summary,example_id").order("sort"),
      sb.from("coin_packs").select("id,name,coins,price_inr,price_usd").eq("active", true).order("sort"),
    ]);
    if (tiers.error || packs.error || !tiers.data?.length || !packs.data?.length) throw tiers.error ?? packs.error;
    return { tiers: tiers.data as Tier[], packs: packs.data as CoinPack[] };
  } catch {
    return { tiers: fallbackTiers, packs: fallbackPacks };
  }
}
