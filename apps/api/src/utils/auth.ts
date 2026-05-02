import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin, openAPI, organization } from "better-auth/plugins";
import { localization } from "better-auth-localization";
import { stripe as stripePlugin } from "@better-auth/stripe";
import Stripe from "stripe";

import { prisma } from "./db";
import {
  sendOrganizationInvitationEmail,
  sendResetPasswordEmail,
  sendVerifyEmail,
} from "./email";
import AuditLogRepository from "@/modules/audit-log/audit-log.repository";

const auditLogRepository = new AuditLogRepository();
import { env } from "@/config/env";
import { ac, roles } from "@/config/permissions";
import { stripePlans, getPlan } from "@/config/plans";

const isProd = env.NODE_ENV === "production";

const stripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-04-22.dahlia",
});

/**
 * Plano ativo do usuário.
 *
 * Prioridade:
 *   1. Custom plan (super_admin definiu pra esse cliente)
 *   2. Stripe subscription ativa/trialing
 *   3. Free
 *
 * Custom plans bypassam o Stripe: cobrança é manual, mas os limites valem.
 */
async function getUserActivePlan(userId: string) {
  // 1. Custom plan tem prioridade (relação 1:1, Stripe sub gerenciada à parte)
  const customPlan = await prisma.customPlan.findUnique({
    where: { userId },
    select: {
      maxOrganizations: true,
      maxPatients: true,
      maxMembers: true,
      auditLog: true,
      customRoles: true,
    },
  });

  if (customPlan) {
    return {
      name: "custom" as const,
      priceId: null,
      trialDays: 0,
      limits: {
        maxOrganizations: customPlan.maxOrganizations,
        maxPatients: customPlan.maxPatients,
        maxMembers: customPlan.maxMembers,
      },
      features: {
        auditLog: customPlan.auditLog,
        customRoles: customPlan.customRoles,
      },
    };
  }

  // 2. Stripe subscription regular
  const sub = await prisma.subscription.findFirst({
    where: {
      referenceId: userId,
      status: { in: ["active", "trialing"] },
    },
  });
  return getPlan(sub?.plan ?? "free");
}

/**
 * Slug determinístico baseado no userId. Garante unicidade sem precisar
 * checar colisão (uuid é único).
 */
function slugFromUserId(userId: string) {
  const base = userId.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return `c-${base.slice(0, 16)}`;
}

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: env.ALLOWED_ORIGINS,
  basePath: env.AUTH_BASE_URL,

  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  // Campos extras do user que viajam no payload de session (pro front saber
  // se o usuário foi banido e mostrar a tela com motivo+observação).
  user: {
    additionalFields: {
      banObservation: {
        type: "string",
        required: false,
        input: false, // não pode ser setado via API normal — só pelo super_admin
      },
      bannedAt: {
        type: "date",
        required: false,
        input: false,
      },
    },
  },

  // Hook de banco: depois que o usuário é criado, crio uma org "Meu consultório"
  // e adiciono ele como owner. Isso esconde o conceito de org pra usuários
  // solo (planos free/pro) — eles têm uma org, mas a UI nunca mostra.
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          try {
            const orgId = crypto.randomUUID();
            await prisma.organization.create({
              data: {
                id: orgId,
                name: "Meu consultório",
                slug: slugFromUserId(user.id),
                metadata: JSON.stringify({ autoCreated: true }),
              },
            });
            await prisma.member.create({
              data: {
                id: crypto.randomUUID(),
                userId: user.id,
                organizationId: orgId,
                role: "owner",
              },
            });
            await auditLogRepository.create({
              userId: user.id,
              organizationId: orgId,
              action: "auto_create",
              resource: "organization",
              resourceId: orgId,
              metadata: { autoCreated: true, userEmail: user.email },
            });
          } catch (e) {
            // não bloqueia o signup se a auto-criação falhar
            console.error("[auth] failed to auto-create org for user", user.id, e);
          }
        },
      },
    },
  },

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
      // ─── Audit hooks ──────────────────────────────────────────────────────
      // Tudo o que rola via /api/auth/organization/* é capturado aqui (o
      // auditPlugin HTTP ignora /api/auth). Cada hook anota quem fez, em qual
      // org, e o conteúdo relevante.
      organizationHooks: {
        // Enforça maxMembers do plano do owner. Conta members atuais + convites
        // pendentes pra evitar burlar (criar 10 convites num plano de 2 membros).
        beforeCreateInvitation: async ({ organization, inviter }) => {
          const owners = await prisma.member.findMany({
            where: {
              organizationId: organization.id,
              role: { contains: "owner" },
            },
            select: { userId: true },
          });
          const ownerId = owners[0]?.userId ?? inviter.userId ?? inviter.id;

          const sub = await prisma.subscription.findFirst({
            where: {
              referenceId: ownerId,
              status: { in: ["active", "trialing"] },
            },
          });
          const plan = getPlan(sub?.plan ?? "free");

          const [memberCount, pendingInvites] = await Promise.all([
            prisma.member.count({ where: { organizationId: organization.id } }),
            prisma.invitation.count({
              where: { organizationId: organization.id, status: "pending" },
            }),
          ]);

          const used = memberCount + pendingInvites;
          if (used >= plan.limits.maxMembers) {
            throw new Error(
              `Limite de membros atingido (${plan.limits.maxMembers}). Faça upgrade pra liberar mais convites.`,
            );
          }
        },
        afterCreateOrganization: async ({ organization, user }) => {
          await auditLogRepository.create({
            userId: user.id,
            organizationId: organization.id,
            action: "create",
            resource: "organization",
            resourceId: organization.id,
            metadata: { name: organization.name, slug: organization.slug },
          });
        },
        afterUpdateOrganization: async ({ organization, user }) => {
          if (!user || !organization) return;
          await auditLogRepository.create({
            userId: user.id,
            organizationId: organization.id,
            action: "update",
            resource: "organization",
            resourceId: organization.id,
            metadata: { name: organization.name, slug: organization.slug },
          });
        },
        afterDeleteOrganization: async ({ organization, user }) => {
          if (!user || !organization) return;
          await auditLogRepository.create({
            userId: user.id,
            organizationId: null, // a org não existe mais
            action: "delete",
            resource: "organization",
            resourceId: organization.id,
            metadata: { name: organization.name, slug: organization.slug },
          });
        },
        afterAddMember: async ({ member, user, organization }) => {
          if (!user) return;
          await auditLogRepository.create({
            userId: user.id,
            organizationId: organization.id,
            action: "add",
            resource: "member",
            resourceId: member.id,
            metadata: { addedUserId: member.userId, role: member.role },
          });
        },
        afterRemoveMember: async ({ member, user, organization }) => {
          if (!user) return;
          await auditLogRepository.create({
            userId: user.id,
            organizationId: organization.id,
            action: "remove",
            resource: "member",
            resourceId: member.id,
            metadata: { removedUserId: member.userId, role: member.role },
          });
        },
        afterUpdateMemberRole: async ({ member, user, organization }) => {
          if (!user) return;
          await auditLogRepository.create({
            userId: user.id,
            organizationId: organization.id,
            action: "update_role",
            resource: "member",
            resourceId: member.id,
            metadata: { role: member.role, userId: member.userId },
          });
        },
        afterCreateInvitation: async ({ invitation, inviter, organization }) => {
          if (!inviter) return;
          await auditLogRepository.create({
            userId: inviter.userId ?? inviter.id,
            organizationId: organization.id,
            action: "create",
            resource: "invitation",
            resourceId: invitation.id,
            metadata: { email: invitation.email, role: invitation.role },
          });
        },
        afterAcceptInvitation: async ({ invitation, member, user, organization }) => {
          if (!user) return;
          await auditLogRepository.create({
            userId: user.id,
            organizationId: organization.id,
            action: "accept",
            resource: "invitation",
            resourceId: invitation.id,
            metadata: {
              email: invitation.email,
              role: invitation.role,
              memberId: member.id,
            },
          });
        },
        afterRejectInvitation: async ({ invitation, user, organization }) => {
          if (!user) return;
          await auditLogRepository.create({
            userId: user.id,
            organizationId: organization.id,
            action: "reject",
            resource: "invitation",
            resourceId: invitation.id,
            metadata: { email: invitation.email },
          });
        },
        afterCancelInvitation: async ({ invitation, cancelledBy, organization }) => {
          if (!cancelledBy) return;
          await auditLogRepository.create({
            userId: cancelledBy.id,
            organizationId: organization.id,
            action: "cancel",
            resource: "invitation",
            resourceId: invitation.id,
            metadata: { email: invitation.email },
          });
        },
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
    sendResetPassword: async ({ user, url }) => {
      await sendResetPasswordEmail({
        to: user.email,
        userName: user.name ?? null,
        resetUrl: url,
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerifyEmail({
        to: user.email,
        userName: user.name ?? null,
        verifyUrl: url,
      });
    },
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
