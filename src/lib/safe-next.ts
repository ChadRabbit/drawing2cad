/** Only same-site paths are allowed as a post-login destination. */
export function safeNext(next: string | null | undefined, fallback = "/") {
  // Browsers drop tabs and newlines and read "\" as "/", so "/\t/evil.com" would become "//evil.com".
  if (!next || !next.startsWith("/") || /[\x00-\x1f\x7f\\]/.test(next)) return fallback;
  const base = "https://same.site";
  const url = new URL(next, base);
  if (url.origin !== base) return fallback;
  // Normalising can itself produce "//host" (e.g. "/.//evil.com"), so check the result too.
  const out = url.pathname + url.search + url.hash;
  return out.startsWith("//") ? fallback : out;
}
