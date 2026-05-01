import BillingRepository from "./billing.repository";

export default class BillingService {
  constructor(private repository: BillingRepository) {}

  /**
   * Resumo completo de billing do usuário: assinatura local + invoices
   * + payment method (do Stripe). Devolvemos `null` em campos que
   * dependem de customer ainda não criado (free tier).
   */
  async getBillingSummary(userId: string) {
    const [subscription, customerId] = await Promise.all([
      this.repository.findActiveSubscriptionByUser(userId),
      this.repository.findUserStripeCustomerId(userId),
    ]);

    if (!customerId) {
      return {
        subscription,
        customerId: null,
        invoices: [],
        paymentMethod: null,
      };
    }

    const [invoices, paymentMethod] = await Promise.all([
      this.repository.listInvoices(customerId).catch(() => []),
      this.repository.getDefaultPaymentMethod(customerId).catch(() => null),
    ]);

    return { subscription, customerId, invoices, paymentMethod };
  }
}
