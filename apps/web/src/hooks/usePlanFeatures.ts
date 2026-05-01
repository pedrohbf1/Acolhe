import { useActiveOrganization, useActivePlan } from "./useOrganizations";
import { useAuth } from "./useAuth";

/**
 * Decide quais features da UI estão disponíveis baseado no plano + role.
 *
 * Regra de negócio:
 * - Free / Pro: usuário é solo. Nem vê o conceito de "organização" (a auto-
 *   criada existe escondida no banco). Sem switcher, sem membros, sem cargos,
 *   sem audit log.
 * - Team: tudo liberado. UI completa de team mostra.
 *
 * Owner gating:
 * - Roles + audit log são owner-only mesmo dentro do Team.
 */
export function usePlanFeatures() {
  const plan = useActivePlan();
  const { data: org } = useActiveOrganization();
  const { user } = useAuth();

  const isTeamPlan = plan === "team";

  const myMember = org?.members?.find((m) => m.userId === user?.id);
  const isOwner = myMember?.role?.includes("owner") ?? false;

  return {
    plan,
    isTeamPlan,
    isOwner,
    /** Mostra o seletor de organização no sidebar e a opção "criar org". */
    canSeeOrgSwitcher: isTeamPlan,
    /** Mostra a aba "Membros" e botão de convidar. */
    canManageMembers: isTeamPlan,
    /** Mostra a aba "Cargos" (custom roles). Só owner do plano team. */
    canManageRoles: isTeamPlan && isOwner,
    /** Mostra a aba "Logs" (audit). Só owner do plano team. */
    canViewAuditLogs: isTeamPlan && isOwner,
    /** Permite criar mais organizações. */
    canCreateOrg: isTeamPlan,
  };
}
