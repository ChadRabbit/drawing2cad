"use client";

import { useEffect, useState } from "react";
import type { Currency } from "./pricing";

/** ₹ for visitors in India, $ for everyone else. Country comes from the cc cookie the proxy sets on Vercel. */
export function detectCurrency(): Currency {
  const cc = document.cookie.match(/(?:^|; )cc=([A-Z]{2})/)?.[1];
  if (cc) return cc === "IN" ? "INR" : "USD";
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return tz === "Asia/Kolkata" || tz === "Asia/Calcutta" ? "INR" : "USD";
}

export function useCurrency(): Currency | null {
  const [currency, setCurrency] = useState<Currency | null>(null);
  useEffect(() => {
    setCurrency(detectCurrency());
  }, []);
  return currency;
}
