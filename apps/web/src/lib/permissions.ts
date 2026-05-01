/**
 * Espelha apps/api/src/config/permissions.ts.
 *
 * Mantenha os dois arquivos em sincronia — Better Auth precisa que o cliente
 * conheça os mesmos statements/roles que o servidor para `hasPermission`
 * funcionar offline.
 */
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/organization/access";

export const statement = defaultStatements;
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
