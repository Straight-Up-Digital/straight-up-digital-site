export async function verifyTurnstile(token: string, secret: string, remoteIp?: string, fetcher: typeof fetch = fetch): Promise<boolean | null> {
  if (!token || !secret) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);
  try {
    const response = await fetcher("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body,
    });
    if (!response.ok) return null;
    const result = await response.json() as { success?: unknown };
    return typeof result.success === "boolean" ? result.success : null;
  } catch { return null; }
}
