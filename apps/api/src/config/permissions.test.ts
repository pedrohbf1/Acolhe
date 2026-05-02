/**
 * Testes da matriz de permissões.
 *
 * Cobre:
 * - statement tem todos os recursos esperados (domínio + better-auth)
 * - role "owner" tem TODAS as ações de TODOS os recursos
 * - role "user" tem só `ac:read` (ver cargos disponíveis)
 * - STATEMENT_KEYS tem o shape esperado pra construir a UI
 */
import { describe, expect, it } from "bun:test";
import { STATEMENT_KEYS, roles, statement } from "./permissions";

const DOMAIN_RESOURCES = [
  "paciente",
  "sessao",
  "prontuario",
  "agenda",
  "financeiro",
  "audit",
] as const;

const BETTER_AUTH_RESOURCES = [
  "organization",
  "member",
  "invitation",
  "ac",
] as const;

describe("statement matrix", () => {
  it("inclui todos os recursos de domínio", () => {
    for (const r of DOMAIN_RESOURCES) {
      expect(statement).toHaveProperty(r);
      expect(Array.isArray(statement[r])).toBe(true);
      expect(statement[r].length).toBeGreaterThan(0);
    }
  });

  it("inclui todos os recursos do better-auth", () => {
    for (const r of BETTER_AUTH_RESOURCES) {
      expect(statement).toHaveProperty(r);
      expect(Array.isArray(statement[r])).toBe(true);
    }
  });

  it("prontuario só tem read e update (nada de create/delete — LGPD)", () => {
    expect([...statement.prontuario].sort()).toEqual(["read", "update"]);
  });

  it("financeiro só tem read e update", () => {
    expect([...statement.financeiro].sort()).toEqual(["read", "update"]);
  });

  it("audit só tem read", () => {
    expect([...statement.audit]).toEqual(["read"]);
  });

  it("agenda tem CRUD completo", () => {
    expect([...statement.agenda].sort()).toEqual([
      "create",
      "delete",
      "read",
      "update",
    ]);
  });
});

describe("roles padrão", () => {
  // Better-auth roles têm uma API "private" — testamos via estrutura interna.
  // Esta é uma asserção de shape: o role.statements deve refletir o que foi
  // declarado em permissions.ts.
  function getRoleStatements(role: typeof roles.owner): Record<string, string[]> {
    // o better-auth coloca as permissões em `role.statements`
    return (role as unknown as { statements: Record<string, string[]> })
      .statements;
  }

  it("owner tem TODAS as ações de TODOS os recursos", () => {
    const ownerPerms = getRoleStatements(roles.owner);
    for (const [resource, actions] of Object.entries(statement)) {
      const ownerActions = ownerPerms[resource] ?? [];
      for (const a of actions) {
        expect(ownerActions).toContain(a);
      }
    }
  });

  it("user tem APENAS ac:read", () => {
    const userPerms = getRoleStatements(roles.user);
    expect(userPerms.ac).toEqual(["read"]);

    // Todos os outros recursos devem estar vazios pro user
    for (const r of [...DOMAIN_RESOURCES, "organization", "member", "invitation"]) {
      const actions = userPerms[r] ?? [];
      expect(actions).toEqual([]);
    }
  });

  it("user NÃO pode mexer em prontuário (regra LGPD)", () => {
    const userPerms = getRoleStatements(roles.user);
    expect(userPerms.prontuario ?? []).toEqual([]);
  });

  it("user NÃO pode ver audit log", () => {
    const userPerms = getRoleStatements(roles.user);
    expect(userPerms.audit ?? []).toEqual([]);
  });
});

describe("STATEMENT_KEYS (consumido pela UI de criar cargo)", () => {
  it("tem uma entry pra cada recurso", () => {
    expect(STATEMENT_KEYS.length).toBe(Object.keys(statement).length);
  });

  it("cada entry tem { resource, actions } e bate com o statement", () => {
    for (const k of STATEMENT_KEYS) {
      expect(k).toHaveProperty("resource");
      expect(k).toHaveProperty("actions");
      expect(Array.isArray(k.actions)).toBe(true);
      const expected = statement[k.resource as keyof typeof statement];
      expect([...k.actions].sort()).toEqual([...expected].sort());
    }
  });
});
