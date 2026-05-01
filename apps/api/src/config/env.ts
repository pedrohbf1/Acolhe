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
};
