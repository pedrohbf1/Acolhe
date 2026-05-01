import { rateLimit } from "elysia-rate-limit";
import { RULES } from "./rateLimit.rules";

const SKIP = ["/", "/openapi"];

const READ_METHODS = ["GET", "HEAD", "OPTIONS"] as const;

type ReadMethod = (typeof READ_METHODS)[number];

export type RateLimitRule = {
  prefix: string;
  read: number;
  write: number;
};

function isRead(method: string): method is ReadMethod {
  return (READ_METHODS as readonly string[]).includes(method);
}

function getLimit(
  method: string,
  path: string,
): { max: number; bucketKey: string } {
  for (const rule of RULES) {
    const matchesPrefix = rule.prefix === "*" || path.startsWith(rule.prefix);
    if (!matchesPrefix) continue;

    const bucket = isRead(method) ? "read" : "write";
    return { max: rule[bucket], bucketKey: `${rule.prefix}|${bucket}` };
  }

  return { max: 80, bucketKey: "*|*" };
}

function getClientIp(request: Request) {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() ?? "unknown";
}

export const rateLimitPlugin = rateLimit({
  scoping: "global",
  duration: 60_000,
  generator: (request) => {
    const { pathname } = new URL(request.url);
    const { bucketKey } = getLimit(request.method, pathname);
    return `${getClientIp(request)}|${bucketKey}`;
  },
  max: (_key, request) => {
    const { pathname } = new URL(request.url);
    return getLimit(request.method, pathname).max;
  },
  skip: (request) => {
    const { pathname } = new URL(request.url);
    return SKIP.some((p) =>
      p === "/" ? pathname === p : pathname.startsWith(p),
    );
  },
  errorResponse: new Response(
    JSON.stringify({
      message: "Muitas requisições. Tente novamente em instantes.",
    }),
    { status: 429, headers: { "Content-Type": "application/json" } },
  ),
});
