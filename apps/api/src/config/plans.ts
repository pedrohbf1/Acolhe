/**
 * Catálogo de planos do useAcolhe.
 *
 * Edite aqui sempre que precisar mexer em preço, limites ou criar plano novo.
 * O resto do código consome este arquivo, então mudar aqui propaga para:
 *   - lista de planos do Stripe (auth.ts -> subscription.plans)
 *   - enforcement de limites (organizationLimit, getActivePlan)
 *
 * Como adicionar um plano novo:
 *   1. Crie a entrada em PLANS abaixo (com priceId real do Stripe se for pago)
 *   2. Tipos derivam automático via PlanName
 *   3. Limites são aplicados onde getPlan(name).limits for consultado
 */
import { env } from "./env";

export type PlanName = "free" | "pro" | "team";

export type PlanLimits = {
  /** Quantas organizações o usuário pode criar tendo este plano. */
  maxOrganizations: number;
  /** Quantos pacientes a organização pode cadastrar. */
  maxPatients: number;
  /**
   * Quantos membros (incluindo o owner) a organização pode ter.
   * 1 = só o owner, sem convites. 2+ = pode convidar.
   */
  maxMembers: number;
};

/**
 * Features comportamentais que separam os tiers (não-numéricas).
 * Usado pra gate na UI e enforcement no backend.
 */
export type PlanFeatures = {
  /** Permite ver logs de auditoria. Free não, Pro/Team sim. */
  auditLog: boolean;
  /** Permite criar cargos personalizados (RBAC custom). Só Team. */
  customRoles: boolean;
};

export type Plan = {
  name: PlanName;
  /** Stripe Price ID para o ciclo mensal. `null` = plano gratuito (sem Stripe). */
  priceId: string | null;
  /** Stripe Price ID para o ciclo anual. Opcional. */
  annualDiscountPriceId?: string | null;
  /** Trial em dias. 0 = sem trial. */
  trialDays: number;
  limits: PlanLimits;
  features: PlanFeatures;
};

export const PLANS: Record<PlanName, Plan> = {
  free: {
    name: "free",
    priceId: null,
    trialDays: 0,
    limits: { maxOrganizations: 1, maxPatients: 10, maxMembers: 1 },
    features: { auditLog: false, customRoles: false },
  },
  pro: {
    name: "pro",
    priceId: env.STRIPE_PRICE_PRO_MONTHLY ?? "price_pro_monthly_placeholder",
    annualDiscountPriceId: env.STRIPE_PRICE_PRO_YEARLY ?? null,
    trialDays: 7,
    limits: { maxOrganizations: 3, maxPatients: 200, maxMembers: 2 },
    features: { auditLog: true, customRoles: false },
  },
  team: {
    name: "team",
    priceId: env.STRIPE_PRICE_TEAM_MONTHLY ?? "price_team_monthly_placeholder",
    annualDiscountPriceId: env.STRIPE_PRICE_TEAM_YEARLY ?? null,
    trialDays: 7,
    limits: { maxOrganizations: 5, maxPatients: 1000, maxMembers: 5 },
    features: { auditLog: true, customRoles: true },
  },
};

export const FREE_PLAN = PLANS.free;

export function getPlan(name: PlanName | string | null | undefined): Plan {
  if (name && name in PLANS) return PLANS[name as PlanName];
  return FREE_PLAN;
}

/**
 * Planos pagos no formato esperado pelo @better-auth/stripe.
 * O free é omitido — não tem assinatura no Stripe.
 */
export const stripePlans = (Object.values(PLANS) as Plan[])
  .filter((p): p is Plan & { priceId: string } => p.priceId !== null)
  .map((p) => ({
    name: p.name,
    priceId: p.priceId,
    ...(p.annualDiscountPriceId
      ? { annualDiscountPriceId: p.annualDiscountPriceId }
      : {}),
    ...(p.trialDays > 0 ? { freeTrial: { days: p.trialDays } } : {}),
    limits: p.limits as unknown as Record<string, number>,
  }));
