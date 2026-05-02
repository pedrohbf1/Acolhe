import { useActiveOrganization, useActivePlan } from "./useOrganizations";
import { useAuth } from "./useAuth";
import { getPlanDisplay } from "@/lib/plans";

/**
 * Decide quais features da UI estão disponíveis baseado no plano + role.
 *
 * Regras de negócio (opção B do redesign de planos):
 *
 * - **Free**: 1 user. Não convida ninguém. Sem audit log.
 * - **Pro**: Owner + 1 convidado (ex: secretária). Audit log ativo. Sem cargos custom.
 * - **Team**: Até 5 membros. Audit log ativo. Cargos personalizados liberados.
 *
 * Owner gating:
 * - Roles + audit log são owner-only (mesmo dentro do Team / Pro).
 * - Convidar membros requer ser owner.
 */
export function usePlanFeatures() {
  const planName = useActivePlan();
  const plan = getPlanDisplay(planName);
  const { data: org } = useActiveOrganization();
  const { user } = useAuth();

  const isFreePlan = planName === "free";
  const isProPlan = planName === "pro";
  const isTeamPlan = planName === "team";

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
    isOwner,

    /** Plano permite ter > 1 membro? Pro e Team sim, Free não. */
    canHaveMembers: limits.maxMembers > 1,
    /** Mostra a aba "Membros" e botão de convidar (precisa ser owner). */
    canManageMembers: limits.maxMembers > 1,
    /** Pode convidar AGORA? Considera limite + role. */
    canInviteNow: isOwner && memberSlotsLeft > 0 && limits.maxMembers > 1,

    /** Mostra a aba "Cargos" (custom roles). Só Team owner. */
    canManageRoles: plan.capabilities.customRoles && isOwner,
    /** Mostra a aba "Logs" (audit). Pro e Team owners. */
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
