import { prisma } from "@/utils/db";
import type { Prisma } from "../../../generated/prisma/client";

export interface AuditLogFilters {
  page: number;
  limit: number;
  organizationId: string;
  action?: string;
  resource?: string;
  userId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface CreateAuditLogInput {
  userId: string;
  organizationId?: string | null;
  action: string;
  resource: string;
  resourceId: string;
  metadata?: Prisma.InputJsonValue;
  ip?: string;
  userAgent?: string;
}

export default class AuditLogRepository {
  async findAll({
    page,
    limit,
    organizationId,
    action,
    resource,
    userId,
    dateFrom,
    dateTo,
  }: AuditLogFilters) {
    const where: Prisma.AuditLogWhereInput = { organizationId };

    if (action) where.action = action;
    if (resource) where.resource = resource;
    if (userId) where.userId = userId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true, role: true, image: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getDistinctActions(organizationId: string) {
    const rows = await prisma.auditLog.findMany({
      where: { organizationId },
      select: { action: true },
      distinct: ["action"],
      orderBy: { action: "asc" },
    });
    return rows.map((r) => r.action);
  }

  async getDistinctResources(organizationId: string) {
    const rows = await prisma.auditLog.findMany({
      where: { organizationId },
      select: { resource: true },
      distinct: ["resource"],
      orderBy: { resource: "asc" },
    });
    return rows.map((r) => r.resource);
  }

  async findOwnerMembership(userId: string, organizationId: string) {
    return prisma.member.findFirst({
      where: { userId, organizationId },
      select: { id: true, role: true },
    });
  }

  async create(data: CreateAuditLogInput) {
    return prisma.auditLog.create({
      data: { ...data, organizationId: data.organizationId ?? null },
    });
  }
}
