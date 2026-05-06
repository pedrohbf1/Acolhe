import { prisma } from "@/utils/db";
import { stripeClient } from "@/utils/stripe";
import AuditLogRepository from "@/modules/audit-log/audit-log.repository";
import AdminRepository from "./admin.repository";

const audit = new AuditLogRepository();

interface ActorInfo {
  actorId: string;
  ip?: string;
}

export interface CreateCustomPlanInput {
  /** Usuário ÚNICO ao qual o plano vai ser atribuído. */
  userId: string;
  name: string;
  notes?: string;
  monthlyPriceBRL: number;
  yearlyPriceBRL?: number;
  maxOrganizations: number;
  maxPatients: number;
  maxMembers: number;
  auditLog: boolean;
  customRoles: boolean;
}

function reaisToCents(reais: number): number {
  return Math.round(reais * 100);
}

export default class AdminService {
  constructor(private repository: AdminRepository) {}

  // ── Listings + stats ───────────────────────────────────────────────────────
  listUsers = (params: {
    page: number;
    limit: number;
    search?: string;
  }) => this.repository.listUsers(params);

  listOrganizations = (params: {
    page: number;
    limit: number;
    search?: string;
  }) => this.repository.listOrganizations(params);

  listCustomPlans = () => this.repository.listCustomPlans();

  stats = () => this.repository.stats();

  /** Estatísticas ricas com MRR, breakdown de planos, novos usuários 7/30d. */
  richStats = () => this.repository.richStats();

  /** Detalhe completo de um usuário pra o painel super_admin. */
  getUserDetails = (userId: string) => this.repository.getUserDetails(userId);

  /** Detalhe completo de uma org pra o painel super_admin. */
  getOrganizationDetails = (orgId: string) =>
    this.repository.getOrganizationDetails(orgId);

  /** Audit logs paginado com filtros — sem restrição de membership. */
  listAuditLogs = (params: {
    page: number;
    limit: number;
    userId?: string;
    organizationId?: string;
    resource?: string;
    action?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }) => this.repository.listAuditLogs(params);

  getAuditFilterOptions = (scope: {
    userId?: string;
    organizationId?: string;
  }) => this.repository.getAuditFilterOptions(scope);

  // ── Bans ──────────────────────────────────────────────────────────────────
  async banUser(
    input: {
      userId: string;
      reason: string;
      observation?: string;
      expiresAt?: Date | null;
    },
    actor: ActorInfo,
  ) {
    if (input.userId === actor.actorId) {
      throw new Error("Você não pode banir a si mesmo.");
    }
    const result = await this.repository.banUser({
      ...input,
      bannedById: actor.actorId,
    });
    await audit.create({
      userId: actor.actorId,
      organizationId: null,
      action: "ban",
      resource: "user",
      resourceId: input.userId,
      metadata: {
        reason: input.reason,
        observation: input.observation,
        expiresAt: input.expiresAt?.toISOString() ?? null,
      },
      ip: actor.ip,
    });
    return result;
  }

  async unbanUser(userId: string, actor: ActorInfo) {
    const result = await this.repository.unbanUser(userId);
    await audit.create({
      userId: actor.actorId,
      organizationId: null,
      action: "unban",
      resource: "user",
      resourceId: userId,
      metadata: {},
      ip: actor.ip,
    });
    return result;
  }

  async banOrganization(
    input: {
      orgId: string;
      reason: string;
      observation?: string;
    },
    actor: ActorInfo,
  ) {
    const result = await this.repository.banOrganization({
      ...input,
      bannedById: actor.actorId,
    });
    await audit.create({
      userId: actor.actorId,
      organizationId: input.orgId,
      action: "ban",
      resource: "organization",
      resourceId: input.orgId,
      metadata: {
        reason: input.reason,
        observation: input.observation,
      },
      ip: actor.ip,
    });
    return result;
  }

  async unbanOrganization(orgId: string, actor: ActorInfo) {
    const result = await this.repository.unbanOrganization(orgId);
    await audit.create({
      userId: actor.actorId,
      organizationId: orgId,
      action: "unban",
      resource: "organization",
      resourceId: orgId,
      metadata: {},
      ip: actor.ip,
    });
    return result;
  }

  // ─── Custom plans (Stripe-integrated, 1:1 com user) ──────────────────────
  /**
   * Fluxo completo:
   *   1. Valida que o user existe e ainda não tem custom plan
   *   2. Garante que o user tem stripeCustomerId (cria se faltar)
   *   3. Cria Stripe Product (catalogado por user.id)
   *   4. Cria Stripe Price (recurring monthly em BRL)
   *   5. Cria Stripe Subscription com `default_incomplete` — Stripe começa a
   *      cobrar quando user tiver cartão default
   *   6. Persiste CustomPlan com todos os IDs Stripe
   *   7. Audita
   *
   * Se algum passo Stripe falhar, lançamos erro e nenhum CustomPlan é criado.
   * Os recursos Stripe parcialmente criados ficam "órfãos" — pra limpeza,
   * arquive direto no dashboard.
   */
  async createCustomPlan(input: CreateCustomPlanInput, actor: ActorInfo) {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        name: true,
        email: true,
        stripeCustomerId: true,
        customPlan: { select: { id: true } },
      },
    });
    if (!user) throw new Error("Usuário não encontrado.");
    if (user.customPlan) {
      throw new Error(
        "Esse usuário já tem um plano custom. Exclua o atual antes de criar outro.",
      );
    }

    // 1. Garante stripeCustomerId
    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripeClient.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: user.id, source: "useAcolhe-admin-customplan" },
      });
      stripeCustomerId = customer.id;
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId },
      });
    }

    // 2. Cria Stripe Product
    const product = await stripeClient.products.create({
      name: input.name,
      description: input.notes ?? `Plano customizado para ${user.email}`,
      metadata: {
        userId: user.id,
        source: "useAcolhe-customplan",
      },
    });

    // 3. Cria Price (recurring mensal, BRL)
    const monthlyPrice = await stripeClient.prices.create({
      product: product.id,
      unit_amount: reaisToCents(input.monthlyPriceBRL),
      currency: "brl",
      recurring: { interval: "month" },
      metadata: { userId: user.id, source: "useAcolhe-customplan" },
    });

    // 4. (Opcional) Price anual
    let yearlyPriceId: string | null = null;
    if (input.yearlyPriceBRL && input.yearlyPriceBRL > 0) {
      const yearlyPrice = await stripeClient.prices.create({
        product: product.id,
        unit_amount: reaisToCents(input.yearlyPriceBRL),
        currency: "brl",
        recurring: { interval: "year" },
        metadata: { userId: user.id, source: "useAcolhe-customplan" },
      });
      yearlyPriceId = yearlyPrice.id;
    }

    // 5. Cria Subscription com default_incomplete — usuário precisa ter ou
    // configurar cartão padrão pra Stripe coletar. Status fica "incomplete"
    // até a primeira cobrança ser bem-sucedida.
    const subscription = await stripeClient.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: monthlyPrice.id }],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      expand: ["latest_invoice.payment_intent"],
      metadata: { userId: user.id, source: "useAcolhe-customplan" },
    });

    // 6. Persiste o CustomPlan
    const plan = await this.repository.createCustomPlan({
      userId: user.id,
      name: input.name,
      notes: input.notes,
      stripeProductId: product.id,
      stripePriceMonthly: monthlyPrice.id,
      stripePriceYearly: yearlyPriceId,
      stripeSubscriptionId: subscription.id,
      stripeStatus: subscription.status,
      monthlyPriceBRL: input.monthlyPriceBRL,
      yearlyPriceBRL: input.yearlyPriceBRL ?? null,
      maxOrganizations: input.maxOrganizations,
      maxPatients: input.maxPatients,
      maxMembers: input.maxMembers,
      auditLog: input.auditLog,
      customRoles: input.customRoles,
      createdById: actor.actorId,
    });

    // 7. Audit
    await audit.create({
      userId: actor.actorId,
      organizationId: null,
      action: "create",
      resource: "custom_plan",
      resourceId: plan.id,
      metadata: {
        targetUserId: user.id,
        targetEmail: user.email,
        stripeProductId: product.id,
        stripeSubscriptionId: subscription.id,
        monthlyPriceBRL: input.monthlyPriceBRL,
        limits: {
          maxOrganizations: input.maxOrganizations,
          maxPatients: input.maxPatients,
          maxMembers: input.maxMembers,
        },
      },
      ip: actor.ip,
    });

    return plan;
  }

  /**
   * Cancela a Stripe sub e remove o CustomPlan.
   * Stripe Product+Prices ficam arquivados (não dá pra deletar Stripe products
   * com history de uso) — quem quiser pode arquivar manualmente no dashboard.
   */
  async deleteCustomPlan(planId: string, actor: ActorInfo) {
    const plan = await prisma.customPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new Error("Plano não encontrado.");

    // Cancela a sub Stripe (best-effort — se já estiver cancelada, ignora)
    if (plan.stripeSubscriptionId) {
      try {
        await stripeClient.subscriptions.cancel(plan.stripeSubscriptionId);
      } catch (e) {
        console.warn(
          `[admin] erro ao cancelar Stripe sub ${plan.stripeSubscriptionId}:`,
          e,
        );
      }
    }

    // (Opcional) Arquivar product/price — evita deixar lixo. Stripe não permite
    // delete de product com price ativo.
    if (plan.stripeProductId) {
      try {
        await stripeClient.products.update(plan.stripeProductId, {
          active: false,
        });
      } catch (e) {
        console.warn(
          `[admin] erro ao arquivar product ${plan.stripeProductId}:`,
          e,
        );
      }
    }

    await this.repository.deleteCustomPlan(planId);

    await audit.create({
      userId: actor.actorId,
      organizationId: null,
      action: "delete",
      resource: "custom_plan",
      resourceId: planId,
      metadata: {
        targetUserId: plan.userId,
        stripeSubscriptionId: plan.stripeSubscriptionId,
      },
      ip: actor.ip,
    });

    return { ok: true as const };
  }
}
