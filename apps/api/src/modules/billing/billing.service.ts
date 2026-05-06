import Stripe from "stripe";
import { env } from "@/config/env";
import { prisma } from "@/utils/db";
import BillingRepository from "./billing.repository";

const stripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-04-22.dahlia",
});

export default class BillingService {
  constructor(private repository: BillingRepository) {}

  /**
   * Resumo completo de billing do usuário: assinatura local + invoices
   * + payment method (do Stripe). Devolvemos `null` em campos que
   * dependem de customer ainda não criado (free tier).
   */
  async getBillingSummary(userId: string) {
    const [subscription, customerId, customPlanRaw] = await Promise.all([
      this.repository.findActiveSubscriptionByUser(userId),
      this.repository.findUserStripeCustomerId(userId),
      this.repository.findUserCustomPlan(userId),
    ]);

    // Custom plans são criados via Stripe SDK direto (admin.service), então o
    // webhook do better-auth NÃO atualiza nosso CustomPlan.stripeStatus
    // automaticamente. Sincronizamos on-demand: ao buscar o resumo de billing,
    // verificamos a sub no Stripe e atualizamos o status local se mudou.
    const customPlan = customPlanRaw
      ? await this.syncCustomPlanStatus(customPlanRaw)
      : null;

    if (!customerId) {
      return {
        subscription,
        customPlan,
        customerId: null,
        invoices: [],
        paymentMethod: null,
      };
    }

    const [invoices, paymentMethod] = await Promise.all([
      this.repository.listInvoices(customerId).catch(() => []),
      this.repository.getDefaultPaymentMethod(customerId).catch(() => null),
    ]);

    return { subscription, customPlan, customerId, invoices, paymentMethod };
  }

  /**
   * Refresca CustomPlan.stripeStatus consultando a sub na Stripe. Best-effort:
   * se Stripe falhar ou a sub não existir, mantém o estado anterior.
   */
  private async syncCustomPlanStatus<T extends { id: string; stripeSubscriptionId: string | null; stripeStatus: string | null }>(
    plan: T,
  ): Promise<T> {
    if (!plan.stripeSubscriptionId) return plan;
    try {
      const sub = await stripeClient.subscriptions.retrieve(
        plan.stripeSubscriptionId,
      );
      if (sub.status !== plan.stripeStatus) {
        await prisma.customPlan.update({
          where: { id: plan.id },
          data: { stripeStatus: sub.status },
        });
        return { ...plan, stripeStatus: sub.status };
      }
    } catch (e) {
      console.warn(
        `[billing] Failed to refresh CustomPlan ${plan.id} status:`,
        e,
      );
    }
    return plan;
  }

  /**
   * Para usuários com custom plan ainda não pago: busca a URL hosted da
   * primeira invoice (a Stripe usa essa URL pra coletar pagamento numa sub
   * `default_incomplete`). Se a sub já está active/trialing, devolve null —
   * nesse caso o usuário gerencia pelo billing portal.
   */
  async getCustomPlanCheckoutUrl(userId: string): Promise<string | null> {
    const customPlan = await prisma.customPlan.findUnique({
      where: { userId },
      select: { stripeSubscriptionId: true, stripeStatus: true },
    });
    if (!customPlan?.stripeSubscriptionId) return null;
    if (
      customPlan.stripeStatus === "active" ||
      customPlan.stripeStatus === "trialing"
    ) {
      return null;
    }

    // Busca a sub com latest_invoice expandido pra pegar o hosted URL.
    const sub = await stripeClient.subscriptions.retrieve(
      customPlan.stripeSubscriptionId,
      { expand: ["latest_invoice"] },
    );

    const invoice = sub.latest_invoice;
    if (!invoice || typeof invoice === "string") return null;
    return invoice.hosted_invoice_url ?? null;
  }
}
