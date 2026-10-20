"use client";

import Image from "next/image";
import { coinsToMoney, formatMoney, packPrice, type CoinPack, type Tier } from "@/lib/pricing";
import { useCurrency } from "@/lib/useCurrency";
import { site } from "@/lib/site";

export type ExampleInfo = {
  id: string;
  title: string;
  number: string;
  material: string;
  bbox: [number, number, number];
  faces: number;
  mass_g: number;
  step_bytes: number;
};

export default function Pricing({ tiers, packs, examples }: { tiers: Tier[]; packs: CoinPack[]; examples: Record<string, ExampleInfo> }) {
  const currency = useCurrency();

  return (
    <section id="pricing" className="pricing scheme-light" aria-labelledby="pricing-title">
      <div className="pricing__head">
        <h2 id="pricing-title" className="pricing__title" data-reveal="">
          Coins per part
        </h2>
        <p className="pricing__aside" data-reveal="" style={{ ["--i" as string]: 1 }}>
          We set the level when we read your drawing, and you confirm it before anything is charged.
        </p>
      </div>

      <ul className="tiers">
        {tiers.map((t, i) => {
          const ex = examples[t.example_id];
          const exact = currency ? coinsToMoney(t.coins, packs, currency) : null;
          // whole rupees or dollars: "about ₹200", not "about ₹199.60"
          const money = exact === null ? null : Math.round(exact / 100) * 100;
          return (
            <li key={t.id} className="tiers__row" data-reveal="" style={{ ["--i" as string]: i }}>
              {ex && (
                <a className="tiers__thumb" href={`/examples/${ex.id}/model.step`} download aria-label={`Download the example STEP: ${ex.title}`}>
                  <Image src={`/examples/${ex.id}/thumb.webp`} alt="" width={640} height={480} sizes="160px" />
                </a>
              )}
              <div className="tiers__what">
                <h3 className="tiers__name">{t.name}</h3>
                {ex && (
                  <p className="tiers__example">
                    e.g. {ex.title}, {ex.bbox.map((n) => Math.round(n)).join(" × ")} mm
                  </p>
                )}
              </div>
              <p className="tiers__summary">{t.summary}</p>
              <p className="tiers__price">
                <span className="tiers__coins tabular">{t.coins}</span> coins
                {money !== null && currency && <span className="tiers__money tabular">about {formatMoney(money, currency)}</span>}
              </p>
            </li>
          );
        })}
      </ul>

      <div className="packs" data-reveal="">
        <h3 className="packs__title">Coins come in packs</h3>
        <table className="packs__table">
          <thead className="sr-only">
            <tr>
              <th>Pack</th>
              <th>Coins</th>
              <th>Price</th>
              <th>Works out at</th>
            </tr>
          </thead>
          <tbody>
            {packs.map((p) => (
              <tr key={p.id}>
                <th scope="row">{p.name}</th>
                <td className="tabular">{p.coins} coins</td>
                <td className="tabular">{currency ? formatMoney(packPrice(p, currency), currency) : "…"}</td>
                <td className="tabular packs__per">{currency ? `${formatMoney(Math.round(packPrice(p, currency) / p.coins), currency)} a coin` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="packs__note">
          New accounts start with {site.signupCoins} coins, enough for one Simple part. Coins don’t expire.
        </p>
      </div>
    </section>
  );
}
