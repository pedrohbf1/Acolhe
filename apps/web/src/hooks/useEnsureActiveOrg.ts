import { authClient } from "@/lib/auth-client";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useAuth } from "./useAuth";

/**
 * Garante que a sessão tenha sempre uma `activeOrganizationId`.
 *
 * Cenários:
 * - Usuário acabou de criar conta → tem a org auto-criada "Meu consultório"
 *   mas o session.activeOrganizationId vem null. Setamos automaticamente.
 * - Usuário antigo cuja sessão foi criada antes do auto-set existir → mesma
 *   coisa.
 * - Usuário recém-removido da org ativa → setamos a próxima disponível.
 *
 * Sem isso: useActiveOrganization() retorna null, todas as features de
 * organização ficam quebradas (sidebar, settings, audit, roles, etc.).
 */
export function useEnsureActiveOrg() {
  const { user, session } = useAuth();
  const qc = useQueryClient();
  const inFlight = useRef(false);

  useEffect(() => {
    if (!user || !session) return;
    if (session.activeOrganizationId) return;
    if (inFlight.current) return;

    inFlight.current = true;

    (async () => {
      try {
        const listRes = await authClient.organization.list();
        if ("error" in listRes && listRes.error) return;
        const orgs = "data" in listRes ? (listRes.data ?? []) : [];
        if (orgs.length === 0) return;

        const setRes = await authClient.organization.setActive({
          organizationId: orgs[0].id,
        });
        if ("error" in setRes && setRes.error) return;

        qc.invalidateQueries({ queryKey: ["session"] });
        qc.invalidateQueries({ queryKey: ["organization", "active"] });
      } finally {
        inFlight.current = false;
      }
    })();
  }, [user, session, qc]);
}
