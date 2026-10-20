import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.razorpay.com/v1";

export function razorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

function auth() {
  return "Basic " + Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: auth(), "content-type": "application/json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(10000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.description ?? `Razorpay ${res.status}`);
  return body as T;
}

export type RzpOrder = { id: string; amount: number; currency: string; status: string };
export type RzpPayment = { id: string; order_id: string; amount: number; currency: string; status: string };

export function createOrder(amount: number, currency: string, receipt: string, notes: Record<string, string>) {
  return call<RzpOrder>("/orders", { method: "POST", body: JSON.stringify({ amount, currency, receipt, notes }) });
}

export function getPayment(id: string) {
  return call<RzpPayment>(`/payments/${encodeURIComponent(id)}`);
}

export function capturePayment(id: string, amount: number, currency: string) {
  return call<RzpPayment>(`/payments/${encodeURIComponent(id)}/capture`, { method: "POST", body: JSON.stringify({ amount, currency }) });
}

function hmacHex(secret: string, data: string) {
  return createHmac("sha256", secret).update(data).digest("hex");
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Checkout success signature: HMAC-SHA256(order_id|payment_id, key secret). */
export function checkoutSignatureOk(orderId: string, paymentId: string, signature: string) {
  return safeEqual(hmacHex(process.env.RAZORPAY_KEY_SECRET!, `${orderId}|${paymentId}`), signature);
}

/** Webhook signature: HMAC-SHA256(raw body, webhook secret). */
export function webhookSignatureOk(rawBody: string, signature: string) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  return Boolean(secret) && safeEqual(hmacHex(secret!, rawBody), signature);
}
