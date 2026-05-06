import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  useBillingSummary,
  type CustomPlanSummary,
} from "@/hooks/useBillingSummary";
import { useActivePlan, useSubscriptions } from "@/hooks/useOrganizations";
import { authClient } from "@/lib/auth-client";
import { PLANS_DISPLAY, type PlanName } from "@/lib/plans";
import { useMutation } from "@tanstack/react-query";
import {
  Check,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Status que ainda não foram efetivamente cobrados — exigem ação do usuário. */
function isCustomPlanPaid(status: string | null) {
  return status === "active" || status === "trialing";
}

export default function PricingPage() {
  const currentPlan = useActivePlan();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const { data: subs } = useSubscriptions();
  const { data: billing } = useBillingSummary();
  const customPlan = billing?.customPlan ?? null;
  const hasCustomPlan = !!customPlan;
  const customPlanPaid = customPlan
    ? isCustomPlanPaid(customPlan.stripeStatus)
    : false;
  const activeSub = subs?.find(
    (s) => s.status === "active" || s.status === "trialing",
  );

  // super_admin tem acesso irrestrito — não faz sentido mostrar planos pagos.
  if (isSuperAdmin) {
    return (
      <div className="flex flex-col gap-8">
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold tracking-tight">
            Acesso irrestrito
          </h1>
          <p className="text-muted-foreground mt-3">
            Você é super_admin — não há plano nem cobrança associada à sua conta.
            Todas as features estão liberadas.
          </p>
        </div>

        <div className="max-w-md mx-auto w-full pt-3">
          <div className="relative rounded-2xl border-2 border-primary/60 ring-2 ring-primary/20 shadow-xl shadow-primary/10 bg-card p-7 flex flex-col">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-primary text-primary-foreground text-[11px] font-semibold tracking-wide uppercase px-3 py-1 rounded-full inline-flex items-center gap-1.5 shadow-md">
                <ShieldCheck className="size-3.5" />
                Super admin
              </span>
            </div>
            <div className="size-11 rounded-xl flex items-center justify-center bg-primary/15">
              <ShieldCheck className="size-5 text-primary" />
            </div>
            <div className="mt-5">
              <h3 className="text-xl font-semibold">Sem plano</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Dono do produto — acesso total
              </p>
            </div>
            <div className="mt-6">
              <div className="text-3xl font-bold">Grátis</div>
            </div>
            <ul className="mt-6 space-y-2.5 flex-1">
              {[
                "Organizações ilimitadas",
                "Membros ilimitados por org",
                "Pacientes ilimitados",
                "Logs de auditoria",
                "Cargos personalizados",
                "Painel super_admin",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="size-4 shrink-0 mt-0.5 text-primary" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-7">
              <Button
                variant="outline"
                disabled
                className="w-full border-primary/40 text-primary"
              >
                Acesso vitalício ✓
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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

  // ── Caso especial: usuário tem custom plan vinculado ────────────────────
  // Mostramos APENAS o card do custom plan. Se ainda não pagou, o botão
  // "Assinar" leva para a hosted invoice URL da Stripe (que vira o checkout).
  if (hasCustomPlan && customPlan) {
    return (
      <div className="flex flex-col gap-8">
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold tracking-tight">
            Plano sob medida pra você
          </h1>
          <p className="text-muted-foreground mt-3">
            Nossa equipe configurou um plano custom para o seu uso. Os limites e
            preço são os abaixo.
          </p>
          {customPlanPaid && (
            <Link
              to="/configuracoes/billing"
              className="inline-flex items-center gap-1 mt-3 text-sm text-primary hover:underline"
            >
              Ver detalhes da assinatura →
            </Link>
          )}
        </div>

        <div className="max-w-md mx-auto w-full pt-3">
          <CustomPlanCard plan={customPlan} paid={customPlanPaid} />
        </div>

        <p className="text-xs text-muted-foreground text-center max-w-lg mx-auto">
          Pagamentos processados pela Stripe. Em caso de dúvidas sobre limites
          ou ajustes, fale com o suporte.
        </p>
      </div>
    );
  }

  // ── Caso padrão: planos públicos free / pro / team ──────────────────────
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
                  {isCurrent && <Check className="size-4 text-primary" />}
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

// ─── Card do plano customizado ────────────────────────────────────────────────

function CustomPlanCard({
  plan,
  paid,
}: {
  plan: CustomPlanSummary;
  paid: boolean;
}) {
  const features: string[] = [
    `${plan.maxOrganizations} ${plan.maxOrganizations === 1 ? "organização" : "organizações"}`,
    `${plan.maxMembers} ${plan.maxMembers === 1 ? "membro" : "membros"} por org`,
    `${plan.maxPatients.toLocaleString("pt-BR")} pacientes`,
  ];
  if (plan.auditLog) features.push("Logs de auditoria (LGPD)");
  if (plan.customRoles) features.push("Cargos personalizados");
  features.push("Suporte dedicado");

  // Carrega a hosted invoice URL on-demand quando o usuário clica em Assinar.
  const subscribe = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_URL}/billing/custom-plan/checkout-url`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data = (await res.json()) as { url: string | null };
      if (!data.url) {
        throw new Error(
          "Stripe ainda não devolveu a URL de cobrança. Recarregue a página em alguns segundos.",
        );
      }
      window.location.href = data.url;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="relative rounded-2xl border-2 border-amber-500/60 ring-2 ring-amber-500/20 shadow-xl shadow-amber-500/10 bg-card p-7 flex flex-col transition-all">
      {/* Badge superior — só aparece quando o plano está realmente ativo */}
      {paid && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-amber-500 text-white text-[11px] font-semibold tracking-wide uppercase px-3 py-1 rounded-full inline-flex items-center gap-1.5 shadow-md">
            <CheckCircle2 className="size-3.5" />
            Esse é meu plano
          </span>
        </div>
      )}
      {!paid && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-foreground text-background text-[11px] font-semibold tracking-wide uppercase px-3 py-1 rounded-full inline-flex items-center gap-1.5 shadow-md">
            <Sparkles className="size-3.5" />
            Plano sob medida
          </span>
        </div>
      )}

      <div className="size-11 rounded-xl flex items-center justify-center bg-amber-500/15">
        <Sparkles className="size-5 text-amber-600 dark:text-amber-400" />
      </div>

      <div className="mt-5">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          {plan.name}
          {paid && (
            <Check className="size-4 text-amber-600 dark:text-amber-400" />
          )}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Plano sob medida para sua operação
        </p>
      </div>

      <div className="mt-6">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold">
            {formatBRL(plan.monthlyPriceBRL)}
          </span>
          <span className="text-sm text-muted-foreground">/mês</span>
        </div>
        {!paid && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
            Aguardando pagamento — clique em Assinar pra concluir.
          </p>
        )}
      </div>

      <ul className="mt-6 space-y-2.5 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <Check className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-7">
        {paid ? (
          <Button
            variant="outline"
            disabled
            className="w-full border-amber-500/40 text-amber-700 dark:text-amber-400"
          >
            Plano atual ✓
          </Button>
        ) : (
          <Button
            className="w-full bg-amber-500 hover:bg-amber-600 text-white"
            disabled={subscribe.isPending}
            onClick={() => subscribe.mutate()}
          >
            {subscribe.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Redirecionando...
              </>
            ) : (
              "Assinar"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
