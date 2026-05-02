import { authClient } from "@/lib/auth-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const SWITCH_ORG_MUTATION_KEY = ["org", "switch"] as const;

/**
 * Troca a organização ativa e força o app inteiro a refazer suas queries para
 * que tudo (membros, billing, audit, etc.) reflita o novo contexto.
 *
 * O overlay global escuta `useIsMutating({ mutationKey: SWITCH_ORG_MUTATION_KEY })`
 * pra mostrar a sobreposição enquanto isso roda.
 */
export function useSwitchOrganization() {
  const qc = useQueryClient();

  return useMutation({
    mutationKey: SWITCH_ORG_MUTATION_KEY,
    mutationFn: async (orgId: string) => {
      const res = await authClient.organization.setActive({
        organizationId: orgId,
      });
      if ("error" in res && res.error) throw new Error(res.error.message);

      // Refetch tudo: o app roda em torno da org ativa, então qualquer cache
      // anterior está potencialmente stale.
      await qc.invalidateQueries();

      // Duração mínima visível para o overlay não dar um flash imperceptível —
      // sensação de "carregando o novo sistema".
      await new Promise((r) => setTimeout(r, 450));
    },
    onError: (e: Error) =>
      toast.error(e.message ?? "Erro ao trocar de organização"),
  });
}
