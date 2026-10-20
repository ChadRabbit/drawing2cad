// Prices live in the database (tables tiers and coin_packs); the server functions there are what charge.
// These values are only a fallback for rendering when the database cannot be reached.

export type TierId = "simple" | "medium" | "complex";

export type Tier = {
  id: TierId;
  name: string;
  coins: number;
  summary: string;
  example_id: string;
};

export type CoinPack = {
  id: string;
  name: string;
  coins: number;
  price_inr: number; // paise
  price_usd: number; // cents
};

export type Currency = "INR" | "USD";

export const fallbackTiers: Tier[] = [
  {
    id: "simple",
    name: "Simple",
    coins: 20,
    summary: "One prismatic part: plates, spacers, brackets. Holes, slots, pockets, fillets and chamfers.",
    example_id: "mounting-plate",
  },
  {
    id: "medium",
    name: "Medium",
    coins: 50,
    summary: "Several views with sections: housings, blocks, flanged parts, turned parts with features.",
    example_id: "pillow-block",
  },
  {
    id: "complex",
    name: "Complex",
    coins: 100,
    summary: "Castings and machined housings: shells, ribs, bosses, intersecting bores, many tapped holes.",
    example_id: "gearbox-housing",
  },
];

export const fallbackPacks: CoinPack[] = [
  { id: "starter", name: "Starter", coins: 50, price_inr: 49900, price_usd: 900 },
  { id: "studio", name: "Studio", coins: 150, price_inr: 129900, price_usd: 2400 },
  { id: "workshop", name: "Workshop", coins: 500, price_inr: 399900, price_usd: 7200 },
];

export function packPrice(pack: CoinPack, currency: Currency) {
  return currency === "INR" ? pack.price_inr : pack.price_usd;
}

export function formatMoney(minor: number, currency: Currency) {
  const major = minor / 100;
  const whole = Number.isInteger(major);
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(major);
}

/** What a number of coins costs at the rate of the smallest pack, for showing a money figure next to coins. */
export function coinsToMoney(coins: number, packs: CoinPack[], currency: Currency) {
  const base = [...packs].sort((a, b) => a.coins - b.coins)[0];
  if (!base) return null;
  return Math.round((packPrice(base, currency) / base.coins) * coins);
}
