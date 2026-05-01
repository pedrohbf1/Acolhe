import { Button } from "@/components/ui/button";
import { useActivePlan, useSubscriptions } from "@/hooks/useOrganizations";
import { authClient } from "@/lib/auth-client";
import { PLANS_DISPLAY, type PlanName } from "@/lib/plans";
import { useMutation } from "@tanstack/react-query";
import { Check, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function PricingPage() {
  const currentPlan = useActivePlan();
  const { data: subs } = useSubscriptions();
  const activeSub = subs?.find(
    (s) => s.status === "active" || s.status === "trialing",
  );

  const upgrade = useMutation({
    mutationFn: async (plan: PlanName) => {
      const res = await authClient.subscription.upgrade({
        plan,
        successUrl: `${window.location.origin}/configuracoes/billing?success=1`,
        cancelUrl: `${window.location.origin}/pricing`,
        ...(activeSub?.stripeSubscriptionId
          ? { subscriptionId: activeSub.stripeSubscriptionId }
          : {}),
      });
      if ("error" in res && res.error) throw new Error(res.error.message);
      return res;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight">
          Escolha o plano ideal
        </h1>
        <p className="text-muted-foreground mt-3">
          Comece grátis e atualize quando precisar de mais. Cancele quando
          quiser.
        </p>
        {activeSub && (
          <Link
            to="/configuracoes/billing"
            className="inline-flex items-center gap-1 mt-3 text-sm text-primary hover:underline"
          >
            Ver detalhes da minha assinatura →
          </Link>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto w-full pt-3">
        {PLANS_DISPLAY.map((plan) => {
          const Icon = plan.icon;
          const isCurrent = plan.name === currentPlan;
          const isFree = plan.name === "free";

          return (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-7 flex flex-col transition-all ${
                isCurrent
                  ? "border-primary ring-2 ring-primary/30 shadow-xl shadow-primary/15 bg-card scale-[1.02]"
                  : plan.highlight
                  ? "border-primary/40 shadow-lg shadow-primary/10 bg-card"
                  : "bg-card hover:border-primary/30"
              }`}
            >
              {/* Badge superior: prioriza "atual", senão "popular" */}
              {isCurrent ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-[11px] font-semibold tracking-wide uppercase px-3 py-1 rounded-full inline-flex items-center gap-1.5 shadow-md">
                    <CheckCircle2 className="size-3.5" />
                    Esse é meu plano
                  </span>
                </div>
              ) : plan.highlight ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-foreground text-background text-[11px] font-semibold tracking-wide uppercase px-3 py-1 rounded-full">
                    Mais popular
                  </span>
                </div>
              ) : null}

              <div
                className={`size-11 rounded-xl flex items-center justify-center ${
                  isCurrent ? "bg-primary/15" : "bg-primary/10"
                }`}
              >
                <Icon className="size-5 text-primary" />
              </div>

              <div className="mt-5">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  {plan.label}
                  {isCurrent && (
                    <Check className="size-4 text-primary" />
                  )}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {plan.tagline}
                </p>
              </div>

              <div className="mt-6">
                {plan.priceMonthlyBRL === 0 ? (
                  <div className="text-3xl font-bold">Grátis</div>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">
                      {formatBRL(plan.priceMonthlyBRL ?? 0)}
                    </span>
                    <span className="text-sm text-muted-foreground">/mês</span>
                  </div>
                )}
                {plan.trialDays > 0 && !isCurrent && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {plan.trialDays} dias grátis para testar
                  </p>
                )}
              </div>

              <ul className="mt-6 space-y-2.5 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check
                      className={`size-4 shrink-0 mt-0.5 ${
                        isCurrent ? "text-primary" : "text-primary/70"
                      }`}
                    />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-7">
                {isCurrent ? (
                  <Button
                    variant="outline"
                    disabled
                    className="w-full border-primary/40 text-primary"
                  >
                    Plano atual ✓
                  </Button>
                ) : isFree ? (
                  <Link to="/configuracoes/billing">
                    <Button variant="outline" className="w-full">
                      {activeSub ? "Fazer downgrade" : "Grátis pra sempre"}
                    </Button>
                  </Link>
                ) : (
                  <Button
                    className="w-full"
                    variant={plan.highlight ? "default" : "outline"}
                    disabled={upgrade.isPending}
                    onClick={() => upgrade.mutate(plan.name)}
                  >
                    {upgrade.isPending
                      ? "Redirecionando..."
                      : activeSub
                      ? "Trocar de plano"
                      : "Assinar"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center max-w-lg mx-auto">
        Pagamentos processados pela Stripe. Você pode cancelar ou trocar de
        plano a qualquer momento. Em modo de teste, use o cartão{" "}
        <code className="px-1 py-0.5 rounded bg-muted">4242 4242 4242 4242</code>{" "}
        com qualquer data futura e CVC.
      </p>
    </div>
  );
}
