import type { Metadata } from "next";
import { Suspense } from "react";
import Coins from "./Coins";
import { getPricing } from "@/lib/pricing-server";

export const metadata: Metadata = { title: "Coins" };

export default async function Page() {
  const { packs, tiers } = await getPricing();
  return (
    <main className="page">
      <Suspense>
        <Coins packs={packs} tiers={tiers} />
      </Suspense>
    </main>
  );
}
