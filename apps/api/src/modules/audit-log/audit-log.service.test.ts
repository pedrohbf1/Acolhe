/**
 * Testes unitários do AuditLogService.
 *
 * Roda com `bun test`. Não toca o banco — usa repository fake.
 *
 * Padrão pra outros módulos: o service deve ser 100% testável sem Prisma,
 * passando uma instância mock do repository pelo construtor.
 */
import { describe, expect, it } from "bun:test";
import AuditLogService from "./audit-log.service";
import type AuditLogRepository from "./audit-log.repository";

function makeRepoMock(
  overrides: Partial<AuditLogRepository> = {},
): AuditLogRepository {
  // Fake mínimo viável — completamos com no-ops por padrão.
  const base = {
    async findAll() {
      return { data: [], total: 0, page: 1, limit: 25, totalPages: 0 };
    },
    async getDistinctActions() {
      return [];
    },
    async getDistinctResources() {
      return [];
    },
    async findOwnerMembership() {
      return null;
    },
    async create() {
      return { id: "audit_test", createdAt: new Date() };
    },
  };
  return { ...base, ...overrides } as unknown as AuditLogRepository;
}

const baseInput = {
  page: 1,
  limit: 25,
  organizationId: "org_1",
  requesterUserId: "user_1",
};

describe("AuditLogService", () => {
  describe("getAll", () => {
    it("rejeita quando o usuário não é membro da organização", async () => {
      const repo = makeRepoMock({
        async findOwnerMembership() {
          return null;
        },
      });
      const service = new AuditLogService(repo);

      await expect(service.getAll(baseInput)).rejects.toThrow(/owner/i);
    });

    it("rejeita quando o usuário é membro mas não é owner", async () => {
      const repo = makeRepoMock({
        async findOwnerMembership() {
          return { id: "m1", role: "user" };
        },
      });
      const service = new AuditLogService(repo);

      await expect(service.getAll(baseInput)).rejects.toThrow(/owner/i);
    });

    it("retorna a página quando o usuário é owner", async () => {
      let receivedFilter: unknown = null;
      const repo = makeRepoMock({
        async findOwnerMembership() {
          return { id: "m1", role: "owner" };
        },
        async findAll(params) {
          receivedFilter = params;
          return { data: [], total: 0, page: params.page, limit: params.limit, totalPages: 0 };
        },
      });
      const service = new AuditLogService(repo);

      const result = await service.getAll({
        ...baseInput,
        resource: "paciente",
        action: "create",
      });

      expect(result.page).toBe(1);
      expect(result.limit).toBe(25);
      expect(receivedFilter).toMatchObject({
        organizationId: "org_1",
        resource: "paciente",
        action: "create",
      });
    });

    it("aceita role composta com 'owner' (ex: 'owner,admin')", async () => {
      const repo = makeRepoMock({
        async findOwnerMembership() {
          return { id: "m1", role: "owner,admin" };
        },
      });
      const service = new AuditLogService(repo);

      // Não deve lançar
      await expect(service.getAll(baseInput)).resolves.toBeDefined();
    });
  });

  describe("getFilterOptions", () => {
    it("rejeita não-owner", async () => {
      const service = new AuditLogService(makeRepoMock());
      await expect(
        service.getFilterOptions("user_1", "org_1"),
      ).rejects.toThrow(/owner/i);
    });

    it("retorna actions e resources distintos quando owner", async () => {
      const repo = makeRepoMock({
        async findOwnerMembership() {
          return { id: "m1", role: "owner" };
        },
        async getDistinctActions() {
          return ["create", "update"];
        },
        async getDistinctResources() {
          return ["paciente", "sessao"];
        },
      });
      const service = new AuditLogService(repo);

      const result = await service.getFilterOptions("user_1", "org_1");

      expect(result).toEqual({
        actions: ["create", "update"],
        resources: ["paciente", "sessao"],
      });
    });
  });
});
