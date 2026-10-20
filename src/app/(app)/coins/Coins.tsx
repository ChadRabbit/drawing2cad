"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useAccount } from "@/components/app/AccountProvider";
import { CoinGlyph } from "@/components/app/CoinGlyph";
import { supabaseBrowser } from "@/lib/supabase/client";
import { formatMoney, packPrice, type CoinPack, type Tier } from "@/lib/pricing";
import { useCurrency } from "@/lib/useCurrency";
import { formatDateTime } from "@/lib/jobs";
import { safeNext } from "@/lib/safe-next";
import { site } from "@/lib/site";
import type { LedgerRow } from "@/lib/types";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void };
  }
}

const REASON: Record<LedgerRow["reason"], string> = {
  signup_bonus: "Welcome coins",
  purchase: "Bought",
  conversion: "Converted",
  refund: "Refund",
  grant: "Added by us",
  adjustment: "Adjustment",
};

function loadCheckout() {
  return new Promise<void>((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("The payment window couldn’t load. Check your connection."));
    document.body.appendChild(s);
  });
}

export default function Coins({ packs, tiers }: { packs: CoinPack[]; tiers: Tier[] }) {
  const params = useSearchParams();
  const need = Number(params.get("need") ?? 0) || 0;
  const back = params.get("back") ? safeNext(params.get("back"), "") : "";
  const { profile, refresh } = useAccount();
  const currency = useCurrency();
  const [ledger, setLedger] = useState<LedgerRow[] | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  const loadLedger = useCallback(async () => {
    const { data } = await supabaseBrowser().from("coin_ledger").select("*").order("created_at", { ascending: false }).limit(50);
    setLedger((data ?? []) as LedgerRow[]);
  }, []);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  const buy = async (pack: CoinPack) => {
    if (!currency) return;
    setBuying(pack.id);
    setMessage(null);
    try {
      const res = await fetch("/api/razorpay/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ packId: pack.id, currency }),
      });
      const order = await res.json();
      if (!res.ok) {
        setMessage({
          tone: "bad",
          text: order.error === "payments_off" ? `Online payments aren’t switched on yet. Email ${site.supportEmail} and we’ll top you up.` : order.message,
        });
        setBuying(null);
        return;
      }
      await loadCheckout();
      const rzp = new window.Razorpay!({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: order.name,
        description: order.description,
        prefill: { email: order.email, name: order.fullName },
        theme: { color: "#0f0f0f" },
        modal: { ondismiss: () => setBuying(null) },
        handler: async (r: Record<string, string>) => {
          const v = await fetch("/api/razorpay/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(r) });
          const out = await v.json();
          setBuying(null);
          if (v.ok) {
            setMessage({ tone: "ok", text: `${pack.coins} coins added. Thank you.` });
            await Promise.all([refresh(), loadLedger()]);
          } else {
            setMessage({ tone: "bad", text: out.message });
          }
        },
      });
      rzp.on("payment.failed", () => {
        setBuying(null);
        setMessage({ tone: "bad", text: "The payment didn’t go through. No money was taken; try again or use another method." });
      });
      rzp.open();
    } catch (err) {
      setBuying(null);
      setMessage({ tone: "bad", text: err instanceof Error ? err.message : "Something went wrong." });
    }
  };

  const enough = need > 0 && profile ? profile.coins >= need : false;

  return (
    <>
      <div className="page__head">
        <div>
          <h1 className="page__title">Coins</h1>
          <p className="page__sub">Coins pay for conversions: {tiers.map((t) => `${t.name} ${t.coins}`).join(", ")}. They don’t expire.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <CoinGlyph size={30} />
          <span className="tabular" style={{ fontFamily: "var(--font-display)", fontWeight: 300, fontSize: 44, lineHeight: 1 }}>
            {profile?.coins ?? "–"}
          </span>
        </div>
      </div>

      <AnimatePresence>
        {(need > 0 || message) && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ display: "grid", gap: 10, marginBottom: 20 }}>
            {need > 0 && !enough && (
              <p className="alert" data-tone="info">
                That part needs {need} more coins than you have. Pick a pack below.
              </p>
            )}
            {message && (
              <p className="alert" data-tone={message.tone === "ok" ? "info" : undefined} role="status">
                {message.text}
              </p>
            )}
            {back && enough && (
              <Link href={back} className="btn btn-ink btn-small" style={{ justifySelf: "start" }}>
                Back to your part
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="split">
        <section className="card" aria-labelledby="packs-title">
          <div className="card__pad" style={{ paddingBottom: 6 }}>
            <h2 id="packs-title" className="card__title">
              Buy coins
            </h2>
          </div>
          <div>
            {packs.map((p) => (
              <div key={p.id} className="pack-row">
                <div>
                  <div style={{ fontWeight: 500 }}>{p.name}</div>
                  <div className="muted tabular" style={{ fontSize: 14 }}>
                    {p.coins} coins
                    {currency && ` · ${formatMoney(Math.round(packPrice(p, currency) / p.coins), currency)} a coin`}
                  </div>
                </div>
                <div className="tabular" style={{ fontWeight: 500, fontSize: 18 }}>
                  {currency ? formatMoney(packPrice(p, currency), currency) : "…"}
                </div>
                <button className="btn btn-small" onClick={() => buy(p)} disabled={!currency || buying !== null}>
                  {buying === p.id ? "Opening…" : "Buy"}
                </button>
              </div>
            ))}
          </div>
          <p className="muted card__pad" style={{ fontSize: 13 }}>
            Payments are handled by Razorpay: UPI, cards, net banking and wallets{currency === "USD" ? ", and international cards" : ""}.
          </p>
        </section>

        <section className="card" aria-labelledby="ledger-title">
          <div className="card__pad" style={{ paddingBottom: 6 }}>
            <h2 id="ledger-title" className="card__title">
              History
            </h2>
          </div>
          {ledger === null ? (
            <div className="card__pad">
              <div className="skeleton" style={{ height: 160 }} />
            </div>
          ) : (
            <table className="table">
              <tbody>
                {ledger.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div>{REASON[r.reason]}</div>
                      <div className="muted" style={{ fontSize: 13 }}>
                        {r.job_id ? (
                          <Link className="link" href={`/models/${r.job_id}`}>
                            {r.note}
                          </Link>
                        ) : (
                          r.note
                        )}{" "}
                        · {formatDateTime(r.created_at)}
                      </div>
                    </td>
                    <td className="num" style={{ fontWeight: 500, color: r.delta > 0 ? "var(--lime)" : undefined }}>
                      {r.delta > 0 ? `+${r.delta}` : r.delta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
