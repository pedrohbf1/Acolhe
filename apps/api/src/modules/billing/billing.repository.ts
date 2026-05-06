import { prisma } from "@/utils/db";
import Stripe from "stripe";
import { env } from "@/config/env";

const stripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-04-22.dahlia",
});

export interface InvoiceSummary {
  id: string;
  number: string | null;
  amountPaid: number;
  currency: string;
  status: string | null;
  createdAt: Date;
  hostedUrl: string | null;
  pdfUrl: string | null;
}

export interface PaymentMethodSummary {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export default class BillingRepository {
  async findActiveSubscriptionByUser(userId: string) {
    return prisma.subscription.findFirst({
      where: {
        referenceId: userId,
        status: { in: ["active", "trialing", "past_due"] },
      },
      orderBy: { id: "desc" },
    });
  }

  async findUserStripeCustomerId(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });
    return user?.stripeCustomerId ?? null;
  }

  async findUserCustomPlan(userId: string) {
    return prisma.customPlan.findUnique({ where: { userId } });
  }

  async listInvoices(customerId: string, limit = 12): Promise<InvoiceSummary[]> {
    const invoices = await stripeClient.invoices.list({
      customer: customerId,
      limit,
    });
    return invoices.data.map((i) => ({
      id: i.id ?? "",
      number: i.number,
      amountPaid: i.amount_paid,
      currency: i.currency,
      status: i.status,
      createdAt: new Date(i.created * 1000),
      hostedUrl: i.hosted_invoice_url ?? null,
      pdfUrl: i.invoice_pdf ?? null,
    }));
  }

  async getDefaultPaymentMethod(
    customerId: string,
  ): Promise<PaymentMethodSummary | null> {
    const customer = await stripeClient.customers.retrieve(customerId);
    if (customer.deleted) return null;

    const defaultPmId =
      typeof customer.invoice_settings?.default_payment_method === "string"
        ? customer.invoice_settings.default_payment_method
        : customer.invoice_settings?.default_payment_method?.id ?? null;

    if (!defaultPmId) return null;

    const pm = await stripeClient.paymentMethods.retrieve(defaultPmId);
    if (!pm.card) return null;

    return {
      brand: pm.card.brand,
      last4: pm.card.last4,
      expMonth: pm.card.exp_month,
      expYear: pm.card.exp_year,
    };
  }
}
