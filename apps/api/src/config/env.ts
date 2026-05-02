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
  SITE_URL: getEnv("SITE_URL").default("http://localhost:5173") as string,
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

  // Suporte / feedback
  /** Inbox que recebe os feedbacks enviados pela /feedback. */
  FEEDBACK_TO_EMAIL: getEnv("FEEDBACK_TO_EMAIL").default(
    "pedrohbf12332@gmail.com",
  ) as string,

  // ─── Admin / super-admin (acesso ao painel oculto) ──────────────────────────
  // Setup:
  // 1. Gere o hash da passphrase com `bun run scripts/hash-admin-passphrase.ts <pass>`
  // 2. Cole no `.env` como ADMIN_PASSPHRASE_HASH
  // 3. Gere um segredo aleatório (`openssl rand -hex 32`) em ADMIN_SESSION_SECRET
  // 4. Promova um usuário a `super_admin` no banco (UPDATE user SET role='super_admin'...)
  /** Hash bcrypt-like (Bun.password) da passphrase mestre. */
  ADMIN_PASSPHRASE_HASH: getEnv("ADMIN_PASSPHRASE_HASH").value,
  /** Segredo HMAC para assinar o cookie de unlock do painel admin. */
  ADMIN_SESSION_SECRET: getEnv("ADMIN_SESSION_SECRET").value,
};
