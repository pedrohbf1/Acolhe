import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db";
import { admin, openAPI } from "better-auth/plugins";
import { env } from "@/config/env";
import { localization } from "better-auth-localization";

const isProd = env.NODE_ENV === "production";

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: env.ALLOWED_ORIGINS,
  basePath: env.AUTH_BASE_URL,

  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  plugins: [
    openAPI(),
    localization({
      defaultLocale: "pt-BR",
      fallbackLocale: "default",
    }),
    admin(),
  ],

  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    password: {
      hash: (password: string) => Bun.password.hash(password),
      verify: ({ hash, password }) => Bun.password.verify(password, hash),
    },
    minPasswordLength: 6,
  },

  rateLimit: {
    enabled: true,
    window: 60, // janela em segundos
    max: 20, // máximo de requisições por janela por IP
  },

  advanced: {
    defaultCookieAttributes: {
      sameSite: isProd ? "none" : "lax",
      secure: isProd,
      httpOnly: true,
      path: "/",
    },
  },
});
