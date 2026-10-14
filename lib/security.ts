import { createHmac, timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";
import { getServerEnv } from "@/lib/env";

export function anonymousViewerHash(viewerToken: string) {
  return createHmac("sha256", getServerEnv().AUTH_SECRET).update(viewerToken).digest("hex");
}

export function safeEqual(a: string, b: string) {
  const first = Buffer.from(a);
  const second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
}

export function assertSameOrigin(request: Request) {
  const originHeader = request.headers.get("origin");
  if (!originHeader) throw new Error("Invalid request origin");

  let origin: URL;
  try {
    origin = new URL(originHeader);
  } catch {
    throw new Error("Invalid request origin");
  }
  if (origin.protocol !== "http:" && origin.protocol !== "https:") throw new Error("Invalid request origin");

  const configuredOrigin = new URL(getServerEnv().APP_URL).origin;
  if (origin.origin === configuredOrigin) return;

  // Managed hosts terminate TLS in a reverse proxy, so request.url can contain
  // an internal hostname. Compare the browser Origin with the public Hostinger
  // forwarding headers instead. Browsers cannot set Host or forwarded headers.
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim();
  const requestHost = forwardedHost || request.headers.get("host")?.trim() || new URL(request.url).host;
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim().toLowerCase();
  const protocolMatches = !forwardedProtocol
    || ((forwardedProtocol === "http" || forwardedProtocol === "https") && origin.protocol === `${forwardedProtocol}:`);
  if (protocolMatches && origin.host.toLowerCase() === requestHost.toLowerCase()) return;

  throw new Error("Invalid request origin");
}

export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function consumeRateLimit(rawKey: string, limit: number, windowSeconds: number) {
  const key = anonymousViewerHash(rawKey);
  const now = new Date();
  const bucket = Math.floor(now.getTime() / (windowSeconds * 1000));
  const db = await getDb();
  const record = await db.collection<{ key: string; bucket: number; count: number; expiresAt: Date }>("rateLimits").findOneAndUpdate(
    { key, bucket },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(now.getTime() + windowSeconds * 2000) } },
    { upsert: true, returnDocument: "after" },
  );
  return (record?.count ?? 1) <= limit;
}
