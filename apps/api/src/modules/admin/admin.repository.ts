import { prisma } from "@/utils/db";
import type { Prisma } from "../../../generated/prisma/client";

export default class AdminRepository {
  // ─── Users ────────────────────────────────────────────────────────────────
  listUsers({
    page,
    limit,
    search,
  }: {
    page: number;
    limit: number;
    search?: string;
  }) {
    const where: Prisma.UserWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};
    return Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
          banned: true,
          banReason: true,
          banObservation: true,
          banExpires: true,
          bannedAt: true,
          createdAt: true,
          customPlan: {
            select: {
              id: true,
              name: true,
              monthlyPriceBRL: true,
              stripeStatus: true,
            },
          },
          _count: { select: { members: true, feedbacks: true } },
        },
      }),
      prisma.user.count({ where }),
    ]).then(([data, total]) => ({
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }));
  }

  banUser(input: {
    userId: string;
    reason: string;
    observation?: string;
    bannedById: string;
    expiresAt?: Date | null;
  }) {
    return prisma.user.update({
      where: { id: input.userId },
      data: {
        banned: true,
        banReason: input.reason,
        banObservation: input.observation ?? null,
        banExpires: input.expiresAt ?? null,
        bannedAt: new Date(),
        bannedById: input.bannedById,
      },
    });
  }

  unbanUser(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        banned: false,
        banReason: null,
        banObservation: null,
        banExpires: null,
        bannedAt: null,
        bannedById: null,
      },
    });
  }

  // ─── Orgs ─────────────────────────────────────────────────────────────────
  listOrganizations({
    page,
    limit,
    search,
  }: {
    page: number;
    limit: number;
    search?: string;
  }) {
    const where: Prisma.OrganizationWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { slug: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};
    return Promise.all([
      prisma.organization.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: {
            select: {
              members: true,
              invitations: true,
              auditLogs: true,
            },
          },
        },
      }),
      prisma.organization.count({ where }),
    ]).then(([data, total]) => ({
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }));
  }

  banOrganization(input: {
    orgId: string;
    reason: string;
    observation?: string;
    bannedById: string;
  }) {
    return prisma.organization.update({
      where: { id: input.orgId },
      data: {
        banned: true,
        banReason: input.reason,
        banObservation: input.observation ?? null,
        bannedAt: new Date(),
        bannedById: input.bannedById,
      },
    });
  }

  unbanOrganization(orgId: string) {
    return prisma.organization.update({
      where: { id: orgId },
      data: {
        banned: false,
        banReason: null,
        banObservation: null,
        bannedAt: null,
        bannedById: null,
      },
    });
  }

  /**
   * Detalhe de um usuário pra o painel de super_admin: traz tudo que o painel
   * de marketing/atendimento precisa pra entender quem é a pessoa, em quais
   * organizações ela está (como owner ou membro), quem usa essas orgs, e
   * detalhes da assinatura/plano customizado.
   */
  async getUserDetails(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        image: true,
        role: true,
        banned: true,
        banReason: true,
        banObservation: true,
        banExpires: true,
        bannedAt: true,
        bannedById: true,
        createdAt: true,
        stripeCustomerId: true,
        twoFactorEnabled: true,
        customPlan: true,
        members: {
          select: {
            id: true,
            role: true,
            createdAt: true,
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                logo: true,
                banned: true,
                createdAt: true,
                _count: {
                  select: { members: true, invitations: true },
                },
                members: {
                  select: {
                    id: true,
                    role: true,
                    createdAt: true,
                    user: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: { feedbacks: true, auditLogs: true, invitations: true },
        },
      },
    });
    if (!user) return null;

    // Tudo que ajuda o painel a tomar decisão (renovação, desconto, churn).
    const [
      subscriptions,
      recentAuditLogs,
      recentFeedbacks,
      activeSessions,
    ] = await Promise.all([
      prisma.subscription.findMany({
        where: { referenceId: userId },
        orderBy: { id: "desc" },
      }),
      prisma.auditLog.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 15,
        select: {
          id: true,
          action: true,
          resource: true,
          resourceId: true,
          organizationId: true,
          metadata: true,
          createdAt: true,
        },
      }),
      prisma.feedback.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          type: true,
          subject: true,
          message: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.session.count({
        where: { userId, expiresAt: { gt: new Date() } },
      }),
    ]);

    // Sessão mais recente — proxy razoável pra "último login".
    const lastSession = await prisma.session.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, ipAddress: true, userAgent: true },
    });

    return {
      ...user,
      subscriptions,
      recentAuditLogs,
      recentFeedbacks,
      activeSessions,
      lastSession,
    };
  }

  /**
   * Detalhe de uma organização: members + dono + invites pendentes + plano
   * efetivo do owner (subscription ou custom plan).
   */
  async getOrganizationDetails(orgId: string) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        members: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            role: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
                banned: true,
                customPlan: {
                  select: {
                    id: true,
                    name: true,
                    monthlyPriceBRL: true,
                    stripeStatus: true,
                  },
                },
              },
            },
          },
        },
        invitations: {
          where: { status: "pending" },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
            createdAt: true,
            expiresAt: true,
            inviter: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
        organizationRoles: {
          select: {
            id: true,
            role: true,
            permission: true,
            createdAt: true,
          },
        },
        _count: {
          select: { members: true, invitations: true, auditLogs: true },
        },
      },
    });
    if (!org) return null;

    // Owner (primeiro member com role contendo "owner")
    const owner = org.members.find((m) => m.role.includes("owner"));

    // Subscriptions do owner
    const ownerSubs = owner
      ? await prisma.subscription.findMany({
          where: { referenceId: owner.user.id },
          orderBy: { id: "desc" },
        })
      : [];

    // Logs recentes de auditoria
    const recentAuditLogs = await prisma.auditLog.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    return { ...org, ownerSubscriptions: ownerSubs, recentAuditLogs };
  }

  // ─── Audit logs (sem restrição de membership — visão super_admin) ────────
  async listAuditLogs(params: {
    page: number;
    limit: number;
    userId?: string;
    organizationId?: string;
    resource?: string;
    action?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }) {
    const where: Prisma.AuditLogWhereInput = {
      ...(params.userId ? { userId: params.userId } : {}),
      ...(params.organizationId
        ? { organizationId: params.organizationId }
        : {}),
      ...(params.resource ? { resource: params.resource } : {}),
      ...(params.action ? { action: params.action } : {}),
      ...(params.dateFrom || params.dateTo
        ? {
            createdAt: {
              ...(params.dateFrom ? { gte: params.dateFrom } : {}),
              ...(params.dateTo ? { lte: params.dateTo } : {}),
            },
          }
        : {}),
    };
    return Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
          organization: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]).then(([data, total]) => ({
      data,
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    }));
  }

  /** Valores únicos pra dropdowns de filtro do audit log no painel. */
  async getAuditFilterOptions(scope: { userId?: string; organizationId?: string }) {
    const where: Prisma.AuditLogWhereInput = {
      ...(scope.userId ? { userId: scope.userId } : {}),
      ...(scope.organizationId
        ? { organizationId: scope.organizationId }
        : {}),
    };
    const [actions, resources] = await Promise.all([
      prisma.auditLog.groupBy({
        by: ["action"],
        where,
        _count: { _all: true },
        orderBy: { _count: { action: "desc" } },
      }),
      prisma.auditLog.groupBy({
        by: ["resource"],
        where,
        _count: { _all: true },
        orderBy: { _count: { resource: "desc" } },
      }),
    ]);
    return {
      actions: actions.map((a) => ({ value: a.action, count: a._count._all })),
      resources: resources.map((r) => ({
        value: r.resource,
        count: r._count._all,
      })),
    };
  }

  // ─── Stats agregadas ricas ────────────────────────────────────────────────
  async richStats() {
    const [
      users,
      verifiedUsers,
      orgs,
      bannedUsers,
      bannedOrgs,
      feedbacks,
      newFeedbacks,
      activeSubs,
      trialingSubs,
      pastDueSubs,
      customPlans,
      newUsers7d,
      newUsers30d,
      newOrgs7d,
      newOrgs30d,
      planBreakdown,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { emailVerified: true } }),
      prisma.organization.count(),
      prisma.user.count({ where: { banned: true } }),
      prisma.organization.count({ where: { banned: true } }),
      prisma.feedback.count(),
      prisma.feedback.count({ where: { status: "new" } }),
      prisma.subscription.count({ where: { status: "active" } }),
      prisma.subscription.count({ where: { status: "trialing" } }),
      prisma.subscription.count({ where: { status: "past_due" } }),
      prisma.customPlan.count(),
      prisma.user.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.user.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.organization.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.organization.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.subscription.groupBy({
        by: ["plan", "status"],
        _count: { _all: true },
      }),
    ]);

    // Soma em centavos pra MRR — ignora trial e statuses não-pagantes.
    const mrrAggregate = await prisma.customPlan.aggregate({
      where: { stripeStatus: { in: ["active", "trialing"] } },
      _sum: { monthlyPriceBRL: true },
    });

    return {
      users,
      verifiedUsers,
      orgs,
      bannedUsers,
      bannedOrgs,
      feedbacks,
      newFeedbacks,
      activeSubs,
      trialingSubs,
      pastDueSubs,
      customPlans,
      newUsers7d,
      newUsers30d,
      newOrgs7d,
      newOrgs30d,
      mrrCustomPlansBRL: mrrAggregate._sum.monthlyPriceBRL ?? 0,
      planBreakdown,
    };
  }

  // ─── Custom Plans (1:1 com user, integrado com Stripe) ──────────────────
  listCustomPlans() {
    return prisma.customPlan.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });
  }

  createCustomPlan(input: {
    userId: string;
    name: string;
    notes?: string | null;
    stripeProductId: string;
    stripePriceMonthly: string;
    stripePriceYearly?: string | null;
    stripeSubscriptionId?: string | null;
    stripeStatus?: string | null;
    monthlyPriceBRL: number;
    yearlyPriceBRL?: number | null;
    maxOrganizations: number;
    maxPatients: number;
    maxMembers: number;
    auditLog: boolean;
    customRoles: boolean;
    createdById: string;
  }) {
    return prisma.customPlan.create({
      data: {
        userId: input.userId,
        name: input.name,
        notes: input.notes ?? null,
        stripeProductId: input.stripeProductId,
        stripePriceMonthly: input.stripePriceMonthly,
        stripePriceYearly: input.stripePriceYearly ?? null,
        stripeSubscriptionId: input.stripeSubscriptionId ?? null,
        stripeStatus: input.stripeStatus ?? null,
        monthlyPriceBRL: input.monthlyPriceBRL,
        yearlyPriceBRL: input.yearlyPriceBRL ?? null,
        maxOrganizations: input.maxOrganizations,
        maxPatients: input.maxPatients,
        maxMembers: input.maxMembers,
        auditLog: input.auditLog,
        customRoles: input.customRoles,
        createdById: input.createdById,
      },
    });
  }

  updateCustomPlan(id: string, data: Prisma.CustomPlanUpdateInput) {
    return prisma.customPlan.update({ where: { id }, data });
  }

  deleteCustomPlan(id: string) {
    return prisma.customPlan.delete({ where: { id } });
  }

  // ─── Stats ────────────────────────────────────────────────────────────────
  async stats() {
    const [users, orgs, bannedUsers, bannedOrgs, feedbacks, newFeedbacks] =
      await Promise.all([
        prisma.user.count(),
        prisma.organization.count(),
        prisma.user.count({ where: { banned: true } }),
        prisma.organization.count({ where: { banned: true } }),
        prisma.feedback.count(),
        prisma.feedback.count({ where: { status: "new" } }),
      ]);
    return {
      users,
      orgs,
      bannedUsers,
      bannedOrgs,
      feedbacks,
      newFeedbacks,
    };
  }
}
