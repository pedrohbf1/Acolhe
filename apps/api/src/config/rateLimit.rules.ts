import type { RateLimitRule } from "./rateLimit";

// Ordem importa — primeiro match vence
// /api/auth é gerenciado pelo rate limit nativo do better-auth
export const RULES: RateLimitRule[] = [
  { prefix: "*", read: 80, write: 80 },
];
