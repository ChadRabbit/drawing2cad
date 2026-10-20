import "server-only";

/** Pings the owner on Telegram when TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set. Never throws. */
export async function notifyOwner(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    // a missed ping must never break the request
  }
}

/** Tells the conversion engine there is work, when ENGINE_WEBHOOK_URL is set. The engine can also just poll. */
export async function pingEngine(event: "job.created" | "job.confirmed", jobId: string) {
  const url = process.env.ENGINE_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.ENGINE_WEBHOOK_SECRET ?? ""}` },
      body: JSON.stringify({ event, job_id: jobId }),
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    // the engine polls as a fallback
  }
}
