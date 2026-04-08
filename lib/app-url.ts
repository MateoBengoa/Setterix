/** Base URL for OAuth redirects; must match Supabase "Redirect URLs" exactly. */
export function getBrowserAppOrigin(): string {
  if (typeof window === "undefined") return "";
  const env = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (env) return env;
  return window.location.origin;
}
