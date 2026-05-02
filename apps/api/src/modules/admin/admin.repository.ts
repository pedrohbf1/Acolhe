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
