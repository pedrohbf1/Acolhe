import { authClient } from "@/lib/auth-client";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useAuth } from "./useAuth";

/**
 * Garante que toda sessão autenticada tenha uma `activeOrganizationId`.
 *
 * Cobre 3 cenários:
 *
 * 1. Usuário NOVO (criado depois do hook do servidor existir):
 *    - server `databaseHooks.user.create.after` já criou "Meu consultório"
 *    - aqui só seteamos como ativa
 *
 * 2. Usuário ANTIGO (criado antes do hook):
 *    - não tem nenhuma org no banco
 *    - criamos "Meu consultório" daqui (a API de create já marca como ativa)
 *
 * 3. Usuário com orgs mas sem ativa (ex: deletou a ativa):
 *    - seteamos a primeira disponível como ativa
 *
 * Sem isso: useActiveOrganization retorna null e tudo de organização quebra
 * (sidebar, settings, audit, roles, etc.).
 */

function slugFromUserId(userId: string) {
  const base = userId.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return `c-${base.slice(0, 16)}`;
}

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

        if (orgs.length === 0) {
          // Caso 2: usuário sem nenhuma org → cria a default
          const slug = slugFromUserId(user.id);
          const createRes = await authClient.organization.create({
            name: "Meu consultório",
            slug,
          });
          if ("error" in createRes && createRes.error) {
            // Slug colidiu (corrida entre tabs?) — tenta listar de novo
            const retryList = await authClient.organization.list();
            const retryOrgs =
              "data" in retryList ? (retryList.data ?? []) : [];
            if (retryOrgs.length > 0) {
              await authClient.organization.setActive({
                organizationId: retryOrgs[0].id,
              });
            }
          }
          // organization.create já seta a nova como ativa
        } else {
          // Caso 3: tem orgs mas nenhuma ativa
          await authClient.organization.setActive({
            organizationId: orgs[0].id,
          });
        }

        qc.invalidateQueries({ queryKey: ["session"] });
        qc.invalidateQueries({ queryKey: ["organization", "active"] });
        qc.invalidateQueries({ queryKey: ["organizations"] });
      } finally {
        inFlight.current = false;
      }
    })();
  }, [user, session, qc]);
}
