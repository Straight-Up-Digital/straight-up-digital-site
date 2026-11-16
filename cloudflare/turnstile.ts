export async function verifyTurnstile(token: string, secret: string, remoteIp?: string, fetcher: typeof fetch = fetch): Promise<boolean> {
  if (!token || !secret) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);
  try {
    const response = await fetcher("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body,
    });
    if (!response.ok) return false;
    const result = await response.json() as { success?: unknown };
    return result.success === true;
  } catch { return false; }
}
