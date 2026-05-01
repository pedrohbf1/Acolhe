/**
 * Único ponto da aplicação que toca em `process.env`.
 * Todo o resto do código importa daqui via `env.NOME_DA_VAR`.
 *
 * Regras:
 * - `.required()`: lança erro no boot se faltar (use para vars sem fallback seguro)
 * - `.default(x)`: retorna o fallback se a var não estiver definida
 * - `.value`: retorna `string | undefined` (use para vars opcionais sem fallback)
 */
function getEnv(key: string) {
  const value = process.env[key];

  return {
    value: value as string | undefined,
    required(): string {
      if (!value)
        throw new Error(`Missing required environment variable: ${key}`);
      return value;
    },
    default(fallback: string | number): string | number {
      return value ?? fallback;
    },
  };
}

export const env = {
  PORT: getEnv("PORT").default(3333),
  NODE_ENV: getEnv("NODE_ENV").default("development"),

  // URLs
  SITE_URL: getEnv("SITE_URL").default("http://localhost:5173"),
  ALLOWED_ORIGINS: (
    getEnv("ALLOWED_ORIGINS").value ?? "http://localhost:5173"
  )
    .split(",")
    .map((s) => s.trim()),

  // Better Auth
  BETTER_AUTH_SECRET: getEnv("BETTER_AUTH_SECRET").required(),
  BETTER_AUTH_URL: getEnv("BETTER_AUTH_URL").required(),
  AUTH_BASE_URL: getEnv("AUTH_BASE_URL").default("/api/auth") as string,

  // Database
  DATABASE_URL: getEnv("DATABASE_URL").required(),
  DIRECT_URL: getEnv("DIRECT_URL").value,

  // Stripe
  STRIPE_SECRET_KEY: getEnv("STRIPE_SECRET_KEY").required(),
  STRIPE_WEBHOOK_SECRET: getEnv("STRIPE_WEBHOOK_SECRET").required(),
  STRIPE_PRICE_PRO_MONTHLY: getEnv("STRIPE_PRICE_PRO_MONTHLY").value,
  STRIPE_PRICE_PRO_YEARLY: getEnv("STRIPE_PRICE_PRO_YEARLY").value,
  STRIPE_PRICE_TEAM_MONTHLY: getEnv("STRIPE_PRICE_TEAM_MONTHLY").value,
  STRIPE_PRICE_TEAM_YEARLY: getEnv("STRIPE_PRICE_TEAM_YEARLY").value,

  // Resend
  RESEND_API_KEY: getEnv("RESEND_API_KEY").required(),
  RESEND_FROM_EMAIL: getEnv("RESEND_FROM_EMAIL").default(
    "useAcolhe <onboarding@resend.dev>",
  ) as string,
};
