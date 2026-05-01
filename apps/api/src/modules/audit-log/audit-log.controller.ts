import Elysia, { t } from "elysia";
import { prisma } from "@/utils/db";
import { betterAuthPlugin } from "@/plugins/better-openApi";

/**
 * Endpoint owner-only para listar logs de auditoria da organização ativa.
 * Restringe pelo `activeOrganizationId` da sessão e pelo role `owner` do user.
 */
export const auditLogController = new Elysia({ prefix: "/audit-logs" })
  .use(betterAuthPlugin)
  .guard({ auth: true })
  .get(
    "/",
    async ({ query, user, session, status }) => {
      const orgId = session.activeOrganizationId;
      if (!orgId) {
        return status(400, { message: "Sem organização ativa" });
      }

      // só owner da org pode ver
      const member = await prisma.member.findFirst({
        where: { userId: user.id, organizationId: orgId },
      });
      if (!member || !member.role.includes("owner")) {
        return status(403, { message: "Apenas o owner pode ver os logs" });
      }

      const page = Math.max(1, query.page ?? 1);
      const limit = Math.min(100, Math.max(1, query.limit ?? 25));
      const skip = (page - 1) * limit;

      const where = {
        organizationId: orgId,
        ...(query.resource ? { resource: query.resource } : {}),
        ...(query.action ? { action: query.action } : {}),
        ...(query.userId ? { userId: query.userId } : {}),
      };

      const [items, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          select: {
            id: true,
            userId: true,
            action: true,
            resource: true,
            resourceId: true,
            metadata: true,
            ip: true,
            userAgent: true,
            createdAt: true,
            user: { select: { id: true, name: true, email: true, image: true } },
          },
        }),
        prisma.auditLog.count({ where }),
      ]);

      return status(200, { items, total, page, limit });
    },
    {
      query: t.Object({
        page: t.Optional(t.Numeric()),
        limit: t.Optional(t.Numeric()),
        resource: t.Optional(t.String()),
        action: t.Optional(t.String()),
        userId: t.Optional(t.String()),
      }),
      detail: { tags: ["Audit"], summary: "Lista logs da organização ativa" },
    },
  );
