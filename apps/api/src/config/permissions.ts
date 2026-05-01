/**
 * Roles padrão das organizações.
 *
 * - `owner`: criador da org. Pode tudo.
 * - `user`:  membro comum. Sem permissões mutativas.
 *
 * Espelho exato em `apps/web/src/lib/permissions.ts` — manter em sincronia.
 *
 * Para roles dinâmicas (criadas em runtime pelo dono da org), ver
 * `dynamicAccessControl` no auth.ts. Ficam armazenadas em `organization_role`.
 *
 * Para adicionar um statement de domínio (ex.: recurso `paciente`), inclua
 * em `statement` abaixo e atribua a cada role.
 */
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/organization/access";

export const statement = {
  ...defaultStatements,
  // paciente: ["create", "read", "update", "delete"],
} as const;

export const ac = createAccessControl(statement);

export const owner = ac.newRole({
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  team: ["create", "update", "delete"],
  ac: ["create", "read", "update", "delete"],
});

export const user = ac.newRole({
  organization: [],
  member: [],
  invitation: [],
  team: [],
  ac: ["read"],
});

export const roles = { owner, user };
