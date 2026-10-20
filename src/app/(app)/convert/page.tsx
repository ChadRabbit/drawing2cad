import type { Metadata } from "next";
import { Suspense } from "react";
import ConvertForm from "./ConvertForm";
import { getPricing } from "@/lib/pricing-server";

export const metadata: Metadata = { title: "New conversion" };

export default async function ConvertPage() {
  const { tiers } = await getPricing();
  return (
    <main className="page">
      <Suspense>
        <ConvertForm tiers={tiers} />
      </Suspense>
    </main>
  );
}
