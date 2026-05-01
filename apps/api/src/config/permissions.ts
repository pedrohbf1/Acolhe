/**
 * Sistema de permissões da organização.
 *
 * Resources de domínio (psicólogo / clínica):
 *   paciente, sessao, prontuario, agenda, financeiro, audit
 *
 * Resources do Better Auth (mantidos como vêm):
 *   organization, member, invitation, ac
 *
 * Notas:
 * - `ac` = manipular as próprias roles (criar/editar/excluir cargos custom).
 * - `team` foi removido porque teams estão desabilitados no auth.ts.
 * - `prontuario` é só read/update (não dá pra "criar" prontuário separado da
 *   sessão; ele nasce junto). Tratá-lo como recurso à parte permite negar
 *   acesso à secretaria sem bloquear acesso ao paciente em si (LGPD).
 *
 * Roles padrão:
 * - owner: tudo
 * - user:  só `ac:read` (pode ver as roles existentes pra entender contexto)
 *
 * Roles dinâmicas (owner cria via UI) ficam em `organization_role` e são
 * aplicadas via Better Auth `dynamicAccessControl`.
 *
 * Espelho exato em `apps/web/src/lib/permissions.ts` — manter em sincronia.
 */
import { createAccessControl } from "better-auth/plugins/access";

export const statement = {
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  ac: ["create", "read", "update", "delete"],

  paciente: ["create", "read", "update", "delete"],
  sessao: ["create", "read", "update", "delete"],
  prontuario: ["read", "update"],
  agenda: ["create", "read", "update", "delete"],
  financeiro: ["read", "update"],
  audit: ["read"],
} as const;

export const ac = createAccessControl(statement);

export const owner = ac.newRole({
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  ac: ["create", "read", "update", "delete"],
  paciente: ["create", "read", "update", "delete"],
  sessao: ["create", "read", "update", "delete"],
  prontuario: ["read", "update"],
  agenda: ["create", "read", "update", "delete"],
  financeiro: ["read", "update"],
  audit: ["read"],
});

export const user = ac.newRole({
  organization: [],
  member: [],
  invitation: [],
  ac: ["read"],
  paciente: [],
  sessao: [],
  prontuario: [],
  agenda: [],
  financeiro: [],
  audit: [],
});

export const roles = { owner, user };

/** Lista de (resource, action) usada pra construir a UI de matriz de permissões. */
export const STATEMENT_KEYS = Object.entries(statement).map(
  ([resource, actions]) => ({
    resource,
    actions: actions as readonly string[],
  }),
);
