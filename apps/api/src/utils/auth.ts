import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin, openAPI, organization } from "better-auth/plugins";
import { localization } from "better-auth-localization";
import { stripe as stripePlugin } from "@better-auth/stripe";
import Stripe from "stripe";

import { prisma } from "./db";
import { sendOrganizationInvitationEmail } from "./email";
import { env } from "@/config/env";
import { ac, roles } from "@/config/permissions";
import { stripePlans, getPlan } from "@/config/plans";

const isProd = env.NODE_ENV === "production";

const stripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-04-22.dahlia",
});

/**
 * Plano ativo do usuário. Sem assinatura ativa/trialing → free.
 * Usado para enforcement do `organizationLimit`.
 */
async function getUserActivePlan(userId: string) {
  const sub = await prisma.subscription.findFirst({
    where: {
      referenceId: userId,
      status: { in: ["active", "trialing"] },
    },
  });
  return getPlan(sub?.plan ?? "free");
}

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

    organization({
      ac,
      roles,
      creatorRole: "owner",
      allowUserToCreateOrganization: true,
      dynamicAccessControl: { enabled: true },
      organizationLimit: async (user) => {
        const plan = await getUserActivePlan(user.id);
        const ownerships = await prisma.member.count({
          where: {
            userId: user.id,
            role: { contains: "owner" },
          },
        });
        return ownerships >= plan.limits.maxOrganizations;
      },
      async sendInvitationEmail(data) {
        const inviteUrl = `${env.SITE_URL}/accept-invitation/${data.id}`;
        const inviter = data.inviter as {
          user: { name?: string | null; email: string };
        };
        await sendOrganizationInvitationEmail({
          to: data.email,
          inviterName: inviter.user.name ?? inviter.user.email,
          organizationName: data.organization.name,
          inviteUrl,
        });
      },
    }),

    stripePlugin({
      stripeClient,
      stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
      createCustomerOnSignUp: true,
      subscription: {
        enabled: true,
        plans: stripePlans,
        requireEmailVerification: false,
      },
    }),
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
    window: 60,
    max: 20,
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
