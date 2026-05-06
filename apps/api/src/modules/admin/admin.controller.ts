import Elysia from "elysia";
import z from "zod";
import { betterAuthPlugin } from "@/plugins/better-openApi";
import {
  ADMIN_COOKIE,
  signMasterToken,
  verifyMasterPassphrase,
  verifyMasterToken,
} from "@/utils/admin-session";
import { env } from "@/config/env";
import FeedbackRepository from "@/modules/feedback/feedback.repository";
import FeedbackService from "@/modules/feedback/feedback.service";
import AdminRepository from "./admin.repository";
import AdminService from "./admin.service";

const repo = new AdminRepository();
const service = new AdminService(repo);

const feedbackRepo = new FeedbackRepository();
const feedbackService = new FeedbackService(feedbackRepo);

// ─── Schemas ─────────────────────────────────────────────────────────────────

const unlockSchema = z.object({
  passphrase: z.string().min(8),
});

const banUserSchema = z.object({
  reason: z.string().min(3).max(200),
  observation: z.string().max(2000).optional(),
  expiresAt: z.string().datetime().optional(),
});

const banOrgSchema = z.object({
  reason: z.string().min(3).max(200),
  observation: z.string().max(2000).optional(),
});

const customPlanSchema = z.object({
  /** Usuário a quem o plano vai ser atribuído (1:1). Required. */
  userId: z.string().min(1),
  name: z.string().min(2).max(80),
  notes: z.string().max(500).optional(),
  /** Required — Stripe precisa do preço pra criar a sub. */
  monthlyPriceBRL: z.number().positive(),
  yearlyPriceBRL: z.number().positive().optional(),
  maxOrganizations: z.number().int().min(1).max(1000),
  maxPatients: z.number().int().min(1).max(1_000_000),
  maxMembers: z.number().int().min(1).max(1000),
  auditLog: z.boolean(),
  customRoles: z.boolean(),
});

const updateFeedbackSchema = z.object({
  status: z.enum(["new", "read", "replied", "archived"]),
  adminNote: z.string().max(2000).optional(),
});

// ─── Helper: extract IP ──────────────────────────────────────────────────────
function getIp(headers: Headers): string | undefined {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
}

// ─── Public unlock endpoints (sob `auth: true`, mas SEM superAdmin guard) ───
//
// Estes ficam montados separadamente porque o usuário precisa "destrancar" antes
// de receber o cookie HMAC. Ainda assim exigem session válida + role super_admin.

export const adminUnlockController = new Elysia({
  tags: ["Admin"],
  prefix: "/admin",
})
  .use(betterAuthPlugin)
  .post(
    "/unlock",
    async ({ status, body, user, request, cookie }) => {
      // role super_admin ou nada — disfarça com 404
      if (user.role !== "super_admin") {
        return status(404, { error: "Not Found" });
      }
      const parsed = unlockSchema.safeParse(body);
      if (!parsed.success) {
        return status(400, { error: "Passphrase inválida" });
      }
      const ok = await verifyMasterPassphrase(parsed.data.passphrase);
      if (!ok) {
        // Log de tentativa falhada — útil pra detectar ataque
        console.warn(
          `[admin] unlock failed — userId=${user.id} ip=${getIp(request.headers)}`,
        );
        return status(401, { error: "Passphrase incorreta" });
      }
      const token = signMasterToken(user.id);
      cookie[ADMIN_COOKIE].set({
        value: token.value,
        httpOnly: true,
        sameSite: env.NODE_ENV === "production" ? "none" : "lax",
        secure: env.NODE_ENV === "production",
        path: "/",
        expires: token.expiresAt,
      });
      return status(200, {
        ok: true,
        expiresAt: token.expiresAt.toISOString(),
      });
    },
    { auth: true },
  )
  .post(
    "/lock",
    async ({ status, cookie }) => {
      cookie[ADMIN_COOKIE].remove();
      return status(200, { ok: true });
    },
    { auth: true },
  )
  .get(
    "/status",
    async ({ user, cookie }) => {
      // Mesmo que role esteja errado, devolvemos 200 com payload neutro pra não
      // entregar a existência do painel. Quem tem role super_admin recebe info real.
      if (user.role !== "super_admin") {
        return { isSuperAdmin: false, unlocked: false };
      }
      const token = cookie[ADMIN_COOKIE]?.value;
      const tokenUserId = verifyMasterToken(token);
      const unlocked = !!tokenUserId && tokenUserId === user.id;
      return { isSuperAdmin: true, unlocked };
    },
    { auth: true },
  );

// ─── Painel real (todas exigem superAdmin guard) ────────────────────────────

export const adminController = new Elysia({
  tags: ["Admin"],
  prefix: "/admin",
})
  .use(betterAuthPlugin)
  // ─── Stats ─────────────────────────────────────────────────────────────────
  .get(
    "/stats",
    async ({ status }) => status(200, await service.stats()),
    { superAdmin: true },
  )
  .get(
    "/stats/rich",
    async ({ status }) => status(200, await service.richStats()),
    { superAdmin: true },
  )
  // ─── Users ─────────────────────────────────────────────────────────────────
  .get(
    "/users",
    async ({ status, query }) => {
      const page = Number(query.page ?? 1);
      const limit = Math.min(100, Number(query.limit ?? 25));
      return status(
        200,
        await service.listUsers({
          page,
          limit,
          search: query.search ?? undefined,
        }),
      );
    },
    { superAdmin: true, query: z.object({ page: z.string().optional(), limit: z.string().optional(), search: z.string().optional() }) },
  )
  .get(
    "/users/:id",
    async ({ status, params }) => {
      const detail = await service.getUserDetails(params.id);
      if (!detail) return status(404, { error: "Usuário não encontrado" });
      return status(200, detail);
    },
    { superAdmin: true },
  )
  .post(
    "/users/:id/ban",
    async ({ status, params, body, user, request }) => {
      const parsed = banUserSchema.safeParse(body);
      if (!parsed.success) {
        return status(400, { error: parsed.error.issues[0]?.message });
      }
      try {
        // Decisão de UX: NÃO revogamos sessões ao banir. Assim o usuário
        // continua "logado" e enxerga a tela de banido com motivo+observação
        // até dar logout. Próximo sign-in fica bloqueado pelo better-auth.
        await service.banUser(
          {
            userId: params.id,
            reason: parsed.data.reason,
            observation: parsed.data.observation,
            expiresAt: parsed.data.expiresAt
              ? new Date(parsed.data.expiresAt)
              : null,
          },
          { actorId: user.id, ip: getIp(request.headers) },
        );
        return status(200, { ok: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro";
        return status(400, { error: msg });
      }
    },
    { superAdmin: true },
  )
  .post(
    "/users/:id/unban",
    async ({ status, params, user, request }) => {
      await service.unbanUser(params.id, {
        actorId: user.id,
        ip: getIp(request.headers),
      });
      return status(200, { ok: true });
    },
    { superAdmin: true },
  )
  // ─── Orgs ──────────────────────────────────────────────────────────────────
  .get(
    "/organizations",
    async ({ status, query }) => {
      const page = Number(query.page ?? 1);
      const limit = Math.min(100, Number(query.limit ?? 25));
      return status(
        200,
        await service.listOrganizations({
          page,
          limit,
          search: query.search ?? undefined,
        }),
      );
    },
    { superAdmin: true, query: z.object({ page: z.string().optional(), limit: z.string().optional(), search: z.string().optional() }) },
  )
  .get(
    "/organizations/:id",
    async ({ status, params }) => {
      const detail = await service.getOrganizationDetails(params.id);
      if (!detail) return status(404, { error: "Organização não encontrada" });
      return status(200, detail);
    },
    { superAdmin: true },
  )
  .post(
    "/organizations/:id/ban",
    async ({ status, params, body, user, request }) => {
      const parsed = banOrgSchema.safeParse(body);
      if (!parsed.success) {
        return status(400, { error: parsed.error.issues[0]?.message });
      }
      await service.banOrganization(
        {
          orgId: params.id,
          reason: parsed.data.reason,
          observation: parsed.data.observation,
        },
        { actorId: user.id, ip: getIp(request.headers) },
      );
      return status(200, { ok: true });
    },
    { superAdmin: true },
  )
  .post(
    "/organizations/:id/unban",
    async ({ status, params, user, request }) => {
      await service.unbanOrganization(params.id, {
        actorId: user.id,
        ip: getIp(request.headers),
      });
      return status(200, { ok: true });
    },
    { superAdmin: true },
  )
  // ─── Custom plans (criados 1:1 com user, integrado com Stripe) ────────────
  .get(
    "/custom-plans",
    async ({ status }) => status(200, await service.listCustomPlans()),
    { superAdmin: true },
  )
  .post(
    "/custom-plans",
    async ({ status, body, user, request }) => {
      const parsed = customPlanSchema.safeParse(body);
      if (!parsed.success) {
        return status(400, { error: parsed.error.issues[0]?.message });
      }
      try {
        const result = await service.createCustomPlan(parsed.data, {
          actorId: user.id,
          ip: getIp(request.headers),
        });
        return status(200, result);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro ao criar plano";
        console.error("[admin] createCustomPlan error:", e);
        return status(400, { error: msg });
      }
    },
    { superAdmin: true },
  )
  .delete(
    "/custom-plans/:id",
    async ({ status, params, user, request }) => {
      try {
        await service.deleteCustomPlan(params.id, {
          actorId: user.id,
          ip: getIp(request.headers),
        });
        return status(200, { ok: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro ao excluir plano";
        return status(400, { error: msg });
      }
    },
    { superAdmin: true },
  )
  // ─── Audit Logs ────────────────────────────────────────────────────────────
  .get(
    "/audit-logs",
    async ({ status, query }) => {
      const page = Number(query.page ?? 1);
      const limit = Math.min(100, Number(query.limit ?? 50));
      const dateFrom = query.dateFrom ? new Date(query.dateFrom) : undefined;
      const dateTo = query.dateTo
        ? (() => {
            const d = new Date(query.dateTo);
            d.setHours(23, 59, 59, 999);
            return d;
          })()
        : undefined;
      return status(
        200,
        await service.listAuditLogs({
          page,
          limit,
          userId: query.userId ?? undefined,
          organizationId: query.organizationId ?? undefined,
          resource: query.resource ?? undefined,
          action: query.action ?? undefined,
          dateFrom,
          dateTo,
        }),
      );
    },
    {
      superAdmin: true,
      query: z.object({
        page: z.string().optional(),
        limit: z.string().optional(),
        userId: z.string().optional(),
        organizationId: z.string().optional(),
        resource: z.string().optional(),
        action: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }),
    },
  )
  .get(
    "/audit-logs/filter-options",
    async ({ status, query }) =>
      status(
        200,
        await service.getAuditFilterOptions({
          userId: query.userId ?? undefined,
          organizationId: query.organizationId ?? undefined,
        }),
      ),
    {
      superAdmin: true,
      query: z.object({
        userId: z.string().optional(),
        organizationId: z.string().optional(),
      }),
    },
  )
  // ─── Feedbacks ─────────────────────────────────────────────────────────────
  .get(
    "/feedbacks",
    async ({ status, query }) => {
      const page = Number(query.page ?? 1);
      const limit = Math.min(100, Number(query.limit ?? 25));
      return status(
        200,
        await feedbackService.list({
          page,
          limit,
          status: query.status ?? undefined,
          type: query.type ?? undefined,
        }),
      );
    },
    { superAdmin: true, query: z.object({ page: z.string().optional(), limit: z.string().optional(), status: z.string().optional(), type: z.string().optional() }) },
  )
  .put(
    "/feedbacks/:id",
    async ({ status, params, body }) => {
      const parsed = updateFeedbackSchema.safeParse(body);
      if (!parsed.success) {
        return status(400, { error: parsed.error.issues[0]?.message });
      }
      const updated = await feedbackService.updateStatus(
        params.id,
        parsed.data.status,
        parsed.data.adminNote,
      );
      return status(200, updated);
    },
    { superAdmin: true },
  );
