/**
 * Testes unitários do BillingService.
 *
 * Foco: garantir que o service degrada bem quando o usuário não tem
 * customer Stripe (free tier) e não estoura quando a Stripe API falha.
 */
import { describe, expect, it } from "bun:test";
import BillingService from "./billing.service";
import type BillingRepository from "./billing.repository";

function makeRepoMock(
  overrides: Partial<BillingRepository> = {},
): BillingRepository {
  const base = {
    async findActiveSubscriptionByUser() {
      return null;
    },
    async findUserStripeCustomerId() {
      return null;
    },
    async listInvoices() {
      return [];
    },
    async getDefaultPaymentMethod() {
      return null;
    },
  };
  return { ...base, ...overrides } as unknown as BillingRepository;
}

describe("BillingService.getBillingSummary", () => {
  it("retorna estado free quando usuário não tem customer Stripe", async () => {
    const repo = makeRepoMock({
      async findActiveSubscriptionByUser() {
        return null;
      },
      async findUserStripeCustomerId() {
        return null;
      },
    });
    const service = new BillingService(repo);

    const result = await service.getBillingSummary("user_1");

    expect(result.subscription).toBeNull();
    expect(result.customerId).toBeNull();
    expect(result.invoices).toEqual([]);
    expect(result.paymentMethod).toBeNull();
  });

  it("agrega subscription + invoices + payment method quando tudo existe", async () => {
    const fakeSub = {
      id: "sub_1",
      plan: "pro",
      referenceId: "user_1",
      status: "active",
    } as never;
    const fakeInvoice = {
      id: "in_1",
      number: "INV-001",
      amountPaid: 4990,
      currency: "brl",
      status: "paid",
      createdAt: new Date("2026-01-01"),
      hostedUrl: null,
      pdfUrl: null,
    };
    const fakePm = {
      brand: "visa",
      last4: "4242",
      expMonth: 12,
      expYear: 2030,
    };

    const repo = makeRepoMock({
      async findActiveSubscriptionByUser() {
        return fakeSub;
      },
      async findUserStripeCustomerId() {
        return "cus_123";
      },
      async listInvoices() {
        return [fakeInvoice];
      },
      async getDefaultPaymentMethod() {
        return fakePm;
      },
    });
    const service = new BillingService(repo);

    const result = await service.getBillingSummary("user_1");

    expect(result.subscription).toEqual(fakeSub);
    expect(result.customerId).toBe("cus_123");
    expect(result.invoices).toEqual([fakeInvoice]);
    expect(result.paymentMethod).toEqual(fakePm);
  });

  it("não estoura quando Stripe falha em listInvoices (degrada gracefully)", async () => {
    const repo = makeRepoMock({
      async findUserStripeCustomerId() {
        return "cus_123";
      },
      async listInvoices() {
        throw new Error("Stripe API down");
      },
      async getDefaultPaymentMethod() {
        return null;
      },
    });
    const service = new BillingService(repo);

    const result = await service.getBillingSummary("user_1");

    expect(result.invoices).toEqual([]); // catch swallowed
    expect(result.customerId).toBe("cus_123");
  });

  it("não estoura quando Stripe falha em paymentMethod", async () => {
    const repo = makeRepoMock({
      async findUserStripeCustomerId() {
        return "cus_123";
      },
      async getDefaultPaymentMethod() {
        throw new Error("Stripe API down");
      },
    });
    const service = new BillingService(repo);

    const result = await service.getBillingSummary("user_1");

    expect(result.paymentMethod).toBeNull();
  });
});
