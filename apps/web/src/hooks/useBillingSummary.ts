import { useQuery } from "@tanstack/react-query";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

export interface InvoiceSummary {
  id: string;
  number: string | null;
  amountPaid: number;
  currency: string;
  status: string | null;
  createdAt: string;
  hostedUrl: string | null;
  pdfUrl: string | null;
}

export interface PaymentMethodSummary {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export interface SubscriptionRecord {
  id: string;
  plan: string;
  status: string;
  periodStart: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean | null;
  trialStart: string | null;
  trialEnd: string | null;
  stripeSubscriptionId: string | null;
}

export interface CustomPlanSummary {
  id: string;
  name: string;
  notes: string | null;
  monthlyPriceBRL: number;
  yearlyPriceBRL: number | null;
  maxOrganizations: number;
  maxPatients: number;
  maxMembers: number;
  auditLog: boolean;
  customRoles: boolean;
  stripeStatus: string | null;
  stripeSubscriptionId: string | null;
  createdAt: string;
}

export interface BillingSummary {
  subscription: SubscriptionRecord | null;
  customPlan: CustomPlanSummary | null;
  customerId: string | null;
  invoices: InvoiceSummary[];
  paymentMethod: PaymentMethodSummary | null;
}

interface Options {
  /** Quando vindo de checkout?success=1, faz polling pra esperar webhook. */
  pollUntilSubscription?: boolean;
}

export function useBillingSummary(opts: Options = {}) {
  return useQuery<BillingSummary>({
    queryKey: ["billing", "summary"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/billing/summary`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      return res.json();
    },
    refetchInterval: (q) => {
      if (!opts.pollUntilSubscription) return false;
      const data = q.state.data as BillingSummary | undefined;
      // poll a cada 2s enquanto webhook não chega
      return data?.subscription ? false : 2000;
    },
    refetchIntervalInBackground: false,
    // para de tentar depois de 30s
    staleTime: 5_000,
  });
}
