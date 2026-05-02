/**
 * Testes do catálogo de planos.
 *
 * Cobre:
 * - shape de cada plano (free / pro / team)
 * - getPlan() resolve nomes válidos e cai no Free pra entradas inválidas
 * - stripePlans (consumido pelo @better-auth/stripe) inclui só pagos e
 *   carrega trial/priceId/limites corretamente
 */
import { describe, expect, it } from "bun:test";
import { FREE_PLAN, PLANS, getPlan, stripePlans } from "./plans";

describe("PLANS catalog", () => {
  it("free é gratuito (priceId null, sem trial) e tem limite mínimo", () => {
    expect(PLANS.free.priceId).toBeNull();
    expect(PLANS.free.trialDays).toBe(0);
    expect(PLANS.free.limits.maxOrganizations).toBe(1);
    expect(PLANS.free.limits.maxMembers).toBe(1);
    expect(PLANS.free.limits.maxPatients).toBeGreaterThan(0);
  });

  it("pro tem priceId, trial de 7 dias e limites maiores que o free", () => {
    expect(PLANS.pro.priceId).toBeTruthy();
    expect(PLANS.pro.trialDays).toBe(7);
    expect(PLANS.pro.limits.maxOrganizations).toBeGreaterThan(
      PLANS.free.limits.maxOrganizations,
    );
    expect(PLANS.pro.limits.maxPatients).toBeGreaterThan(
      PLANS.free.limits.maxPatients,
    );
    expect(PLANS.pro.limits.maxMembers).toBeGreaterThan(
      PLANS.free.limits.maxMembers,
    );
  });

  it("team tem priceId, trial de 7 dias e limites maiores que o pro", () => {
    expect(PLANS.team.priceId).toBeTruthy();
    expect(PLANS.team.trialDays).toBe(7);
    expect(PLANS.team.limits.maxOrganizations).toBeGreaterThan(
      PLANS.pro.limits.maxOrganizations,
    );
    expect(PLANS.team.limits.maxPatients).toBeGreaterThan(
      PLANS.pro.limits.maxPatients,
    );
    expect(PLANS.team.limits.maxMembers).toBeGreaterThan(
      PLANS.pro.limits.maxMembers,
    );
  });

  it("hierarquia de limites é monotonicamente crescente: free < pro < team", () => {
    expect(PLANS.free.limits.maxOrganizations).toBeLessThan(
      PLANS.pro.limits.maxOrganizations,
    );
    expect(PLANS.pro.limits.maxOrganizations).toBeLessThan(
      PLANS.team.limits.maxOrganizations,
    );
    expect(PLANS.free.limits.maxMembers).toBeLessThan(
      PLANS.pro.limits.maxMembers,
    );
    expect(PLANS.pro.limits.maxMembers).toBeLessThan(
      PLANS.team.limits.maxMembers,
    );
  });

  it("features comportamentais separam tiers corretamente", () => {
    // Audit log: Pro e Team têm, Free não.
    expect(PLANS.free.features.auditLog).toBe(false);
    expect(PLANS.pro.features.auditLog).toBe(true);
    expect(PLANS.team.features.auditLog).toBe(true);

    // Custom roles: só Team.
    expect(PLANS.free.features.customRoles).toBe(false);
    expect(PLANS.pro.features.customRoles).toBe(false);
    expect(PLANS.team.features.customRoles).toBe(true);
  });

  it("free não permite convidar (maxMembers=1, só o owner)", () => {
    expect(PLANS.free.limits.maxMembers).toBe(1);
  });

  it("pro permite o owner + 1 convidado (ex: secretária)", () => {
    expect(PLANS.pro.limits.maxMembers).toBe(2);
  });
});

describe("getPlan()", () => {
  it("resolve nomes válidos", () => {
    expect(getPlan("free").name).toBe("free");
    expect(getPlan("pro").name).toBe("pro");
    expect(getPlan("team").name).toBe("team");
  });

  it("cai no free com null/undefined/string desconhecida", () => {
    expect(getPlan(null).name).toBe("free");
    expect(getPlan(undefined).name).toBe("free");
    expect(getPlan("enterprise").name).toBe("free");
    expect(getPlan("").name).toBe("free");
  });

  it("FREE_PLAN é PLANS.free (mesma referência)", () => {
    expect(FREE_PLAN).toBe(PLANS.free);
  });
});

describe("stripePlans (config consumido pelo @better-auth/stripe)", () => {
  it("não inclui o plano free", () => {
    expect(stripePlans.find((p) => p.name === "free")).toBeUndefined();
  });

  it("inclui pro e team", () => {
    const names = stripePlans.map((p) => p.name).sort();
    expect(names).toEqual(["pro", "team"]);
  });

  it("cada plano pago tem priceId não-nulo", () => {
    for (const p of stripePlans) {
      expect(p.priceId).toBeTruthy();
    }
  });

  it("freeTrial só aparece quando trialDays > 0", () => {
    for (const p of stripePlans) {
      const orig = PLANS[p.name as keyof typeof PLANS];
      if (orig.trialDays > 0) {
        expect(p).toHaveProperty("freeTrial");
        expect((p as { freeTrial: { days: number } }).freeTrial.days).toBe(
          orig.trialDays,
        );
      }
    }
  });

  it("limites são propagados pra config do Stripe", () => {
    const proCfg = stripePlans.find((p) => p.name === "pro");
    expect(proCfg?.limits).toMatchObject({
      maxOrganizations: PLANS.pro.limits.maxOrganizations,
      maxPatients: PLANS.pro.limits.maxPatients,
    });
  });
});
