/**
 * Espelha apps/api/src/config/permissions.ts.
 * Manter em sincronia.
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

/** Labels em PT-BR para a UI de roles. */
export const RESOURCE_LABELS: Record<string, string> = {
  organization: "Organização",
  member: "Membros",
  invitation: "Convites",
  ac: "Cargos",
  paciente: "Pacientes",
  sessao: "Sessões",
  prontuario: "Prontuário",
  agenda: "Agenda",
  financeiro: "Financeiro",
  audit: "Logs de auditoria",
};

export const ACTION_LABELS: Record<string, string> = {
  create: "Criar",
  read: "Visualizar",
  update: "Editar",
  delete: "Excluir",
  cancel: "Cancelar",
};

export const STATEMENT_KEYS = Object.entries(statement).map(
  ([resource, actions]) => ({
    resource,
    actions: actions as readonly string[],
  }),
);
