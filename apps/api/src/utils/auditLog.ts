import { prisma } from "@/utils/db";
import { Prisma } from "../../generated/prisma/client";

interface AuditLogInput {
  userId: string;
  organizationId?: string | null;
  action: string;
  resource: string;
  resourceId: string;
  metadata?: Prisma.InputJsonValue;
  ip?: string;
  userAgent?: string;
}

export async function createAuditLog(data: AuditLogInput) {
  return prisma.auditLog.create({
    data: {
      ...data,
      organizationId: data.organizationId ?? null,
    },
  });
}
