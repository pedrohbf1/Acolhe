import Elysia from "elysia";
import z from "zod";
import { betterAuthPlugin } from "@/plugins/better-openApi";
import AuditLogRepository from "./audit-log.repository";
import AuditLogService from "./audit-log.service";

const repository = new AuditLogRepository();
const service = new AuditLogService(repository);

// Schema usado pelo Elysia para validação de tipos (sem transforms).
const queryInput = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  action: z.string().optional(),
  resource: z.string().optional(),
  userId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

// Schema com coerção e transforms aplicado manualmente.
const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  action: z.string().optional(),
  resource: z.string().optional(),
  userId: z.string().optional(),
  dateFrom: z.string().optional().transform((v) => (v ? new Date(v) : undefined)),
  dateTo: z.string().optional().transform((v) => {
    if (!v) return undefined;
    const d = new Date(v);
    d.setHours(23, 59, 59, 999);
    return d;
  }),
});

export const auditLogController = new Elysia({
  tags: ["Audit"],
  prefix: "/audit-logs",
})
  .use(betterAuthPlugin)
  .get("/", async ({ status, query, session, user }) => {
    if (!session.activeOrganizationId) {
      return status(400, { error: "Sem organização ativa" });
    }
    const params = querySchema.parse(query);
    try {
      return status(200, await service.getAll({
        ...params,
        organizationId: session.activeOrganizationId,
        requesterUserId: user.id,
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      return status(403, { error: msg });
    }
  }, {
    auth: true,
    query: queryInput,
  })
  .get("/filter-options", async ({ status, session, user }) => {
    if (!session.activeOrganizationId) {
      return status(400, { error: "Sem organização ativa" });
    }
    try {
      return status(200, await service.getFilterOptions(
        user.id,
        session.activeOrganizationId,
      ));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      return status(403, { error: msg });
    }
  }, {
    auth: true,
  });
