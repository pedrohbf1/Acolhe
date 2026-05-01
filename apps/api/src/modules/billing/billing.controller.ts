import Elysia from "elysia";
import { betterAuthPlugin } from "@/plugins/better-openApi";
import BillingRepository from "./billing.repository";
import BillingService from "./billing.service";

const repository = new BillingRepository();
const service = new BillingService(repository);

export const billingController = new Elysia({
  tags: ["Billing"],
  prefix: "/billing",
})
  .use(betterAuthPlugin)
  .get(
    "/summary",
    async ({ status, user }) => {
      try {
        return status(200, await service.getBillingSummary(user.id));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro ao buscar billing";
        return status(500, { error: msg });
      }
    },
    {
      auth: true,
      detail: { summary: "Resumo de billing (sub + invoices + payment method)" },
    },
  );
