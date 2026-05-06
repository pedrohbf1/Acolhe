import { useActiveOrganization, useActivePlan } from "./useOrganizations";
import { useAuth } from "./useAuth";
import { useBillingSummary } from "./useBillingSummary";
import { getPlanDisplay, type PlanDisplay, type PlanName } from "@/lib/plans";

/**
 * Decide quais features da UI estão disponíveis baseado no plano + role.
 *
 * Regras de negócio (opção B do redesign de planos):
 *
 * - **Free**: 1 user. Não convida ninguém. Sem audit log.
 * - **Pro**: Owner + 1 convidado (ex: secretária). Audit log ativo. Sem cargos custom.
 * - **Team**: Até 5 membros. Audit log ativo. Cargos personalizados liberados.
 * - **Custom**: limites/recursos definidos pelo super_admin. Tem prioridade.
 *
 * Owner gating:
 * - Roles + audit log são owner-only (mesmo dentro do Team / Pro / custom).
 * - Convidar membros requer ser owner.
 */
export function usePlanFeatures() {
  const subPlanName = useActivePlan();
  const { data: billing } = useBillingSummary();
  const { user } = useAuth();
  const customPlan = billing?.customPlan ?? null;
  // Só conta como "custom plan ativo" depois que a Stripe sub está paga.
  // Antes do pagamento, o usuário fica nos limites/features da sub regular
  // (ou free, se não houver) — exatamente como o backend trata.
  const customActive =
    !!customPlan &&
    (customPlan.stripeStatus === "active" ||
      customPlan.stripeStatus === "trialing");

  // super_admin (dono do produto) tem acesso irrestrito — não paga, não tem
  // limite, todas as features ligadas. Vence qualquer outra resolução.
  const isSuperAdmin = user?.role === "super_admin";

  // Plano "efetivo": super_admin > custom (pago) > stripe sub > free
  const planName: PlanName | "custom" | "super_admin" = isSuperAdmin
    ? "super_admin"
    : customActive
      ? "custom"
      : subPlanName;

  // Para exibição/limites, derivamos um PlanDisplay adaptado.
  const plan: PlanDisplay = isSuperAdmin
    ? {
        name: "team", // só pra satisfazer o tipo — o real fica em planName
        label: "Super admin",
        tagline: "Acesso irrestrito",
        priceMonthlyBRL: 0,
        trialDays: 0,
        icon: getPlanDisplay("team").icon,
        features: [],
        limits: {
          maxOrganizations: Number.MAX_SAFE_INTEGER,
          maxPatients: Number.MAX_SAFE_INTEGER,
          maxMembers: Number.MAX_SAFE_INTEGER,
        },
        capabilities: { auditLog: true, customRoles: true },
      }
    : customActive && customPlan
      ? {
          name: "team",
          label: customPlan.name,
          tagline: "Plano sob medida",
          priceMonthlyBRL: customPlan.monthlyPriceBRL,
          trialDays: 0,
          icon: getPlanDisplay("team").icon,
          features: [],
          limits: {
            maxOrganizations: customPlan.maxOrganizations,
            maxPatients: customPlan.maxPatients,
            maxMembers: customPlan.maxMembers,
          },
          capabilities: {
            auditLog: customPlan.auditLog,
            customRoles: customPlan.customRoles,
          },
        }
      : getPlanDisplay(subPlanName);

  const { data: org } = useActiveOrganization();

  const isFreePlan = planName === "free";
  const isProPlan = planName === "pro";
  const isTeamPlan = planName === "team";
  const isCustomPlan = planName === "custom";

  const myMember = org?.members?.find((m) => m.userId === user?.id);
  const isOwner = myMember?.role?.includes("owner") ?? false;

  // Uso atual (pra UI mostrar "X/Y membros usados")
  const currentMembers = org?.members?.length ?? 0;
  const limits = plan.limits;
  const memberSlotsLeft = Math.max(0, limits.maxMembers - currentMembers);

  return {
    plan: planName,
    planDisplay: plan,
    limits,

    isFreePlan,
    isProPlan,
    isTeamPlan,
    isCustomPlan,
    isSuperAdmin,
    isOwner,

    /** Plano permite ter > 1 membro? Pro / Team / custom sim, Free não. */
    canHaveMembers: limits.maxMembers > 1,
    /** Mostra a aba "Membros" e botão de convidar (precisa ser owner). */
    canManageMembers: limits.maxMembers > 1,
    /** Pode convidar AGORA? Considera limite + role. */
    canInviteNow: isOwner && memberSlotsLeft > 0 && limits.maxMembers > 1,

    /** Mostra a aba "Cargos" (custom roles). Só Team / custom owner. */
    canManageRoles: plan.capabilities.customRoles && isOwner,
    /** Mostra a aba "Logs" (audit). Pro / Team / custom owners. */
    canViewAuditLogs: plan.capabilities.auditLog && isOwner,
    /** Permite criar organizações adicionais. */
    canCreateOrg: limits.maxOrganizations > 1,

    /** Estado de uso, usado pra mostrar "X/Y" e bloquear ações. */
    usage: {
      members: currentMembers,
      maxMembers: limits.maxMembers,
      memberSlotsLeft,
    },
  };
}
