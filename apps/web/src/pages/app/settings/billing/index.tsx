import { Button } from "@/components/ui/button";
import { useSubscriptions } from "@/hooks/useOrganizations";
import { authClient } from "@/lib/auth-client";
import { getPlanDisplay } from "@/lib/plans";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  ArrowUpRight,
  CalendarClock,
  CreditCard,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

export default function BillingSettingsPage() {
  const [params] = useSearchParams();
  const justSubscribed = params.get("success") === "1";

  const { data: subs, isLoading } = useSubscriptions();
  const sub = subs?.find(
    (s) => s.status === "active" || s.status === "trialing",
  );
  const plan = getPlanDisplay(sub?.plan);

  const portal = useMutation({
    mutationFn: async () => {
      const res = await authClient.subscription.billingPortal({
        returnUrl: `${window.location.origin}/configuracoes/billing`,
      });
      if ("error" in res && res.error) throw new Error(res.error.message);
      // billingPortal returns a redirect URL
      const data = "data" in res ? res.data : null;
      if (data && typeof data === "object" && "url" in data && data.url) {
        window.location.href = data.url as string;
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: async () => {
      const res = await authClient.subscription.cancel({
        returnUrl: `${window.location.origin}/configuracoes/billing`,
      });
      if ("error" in res && res.error) throw new Error(res.error.message);
    },
    onSuccess: () => toast.success("Assinatura cancelada."),
    onError: (e: Error) => toast.error(e.message),
  });

  const restore = useMutation({
    mutationFn: async () => {
      const res = await authClient.subscription.restore();
      if ("error" in res && res.error) throw new Error(res.error.message);
    },
    onSuccess: () => toast.success("Assinatura restaurada."),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">Carregando…</div>
    );
  }

  const PlanIcon = plan.icon;

  return (
    <div className="flex flex-col gap-8">
      {justSubscribed && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
          <Sparkles className="size-5 text-primary shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-sm">Pagamento confirmado!</div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Pode levar alguns segundos para os limites do novo plano serem
              aplicados. Atualize a página se algo parecer fora.
            </p>
          </div>
        </div>
      )}

      <section className="rounded-xl border bg-card p-6">
        <header className="flex items-start justify-between gap-4 flex-wrap mb-5">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <PlanIcon className="size-5 text-primary" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Plano atual
              </div>
              <div className="text-xl font-semibold">{plan.label}</div>
              {sub?.status === "trialing" && (
                <div className="text-xs text-amber-600 mt-1">
                  Em período de avaliação
                </div>
              )}
            </div>
          </div>
          <Link to="/pricing">
            <Button variant="outline" className="gap-2">
              {sub ? "Mudar de plano" : "Fazer upgrade"}
              <ArrowUpRight className="size-4" />
            </Button>
          </Link>
        </header>

        {sub ? (
          <div className="grid gap-4 sm:grid-cols-2 mt-6">
            <Stat
              icon={CalendarClock}
              label="Próxima cobrança"
              value={
                sub.periodEnd
                  ? format(new Date(sub.periodEnd), "d 'de' MMMM, yyyy", {
                      locale: ptBR,
                    })
                  : "—"
              }
            />
            <Stat
              icon={CreditCard}
              label="Status"
              value={
                sub.status === "active"
                  ? "Ativa"
                  : sub.status === "trialing"
                  ? "Em trial"
                  : sub.status
              }
            />
          </div>
        ) : (
          <div className="rounded-lg bg-muted/30 p-4 mt-2 text-sm text-muted-foreground">
            Você está no plano <strong>Free</strong>. Faça upgrade para
            desbloquear mais organizações e pacientes.
          </div>
        )}

        <ul className="mt-6 space-y-1">
          {plan.features.map((f) => (
            <li
              key={f}
              className="text-sm text-muted-foreground flex items-center gap-2"
            >
              <span className="size-1 rounded-full bg-muted-foreground/40" />
              {f}
            </li>
          ))}
        </ul>
      </section>

      {sub && (
        <section className="rounded-xl border bg-card p-6">
          <header className="mb-5">
            <h2 className="text-base font-semibold">Pagamento</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Métodos de pagamento, faturas e dados de cobrança.
            </p>
          </header>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => portal.mutate()}
            disabled={portal.isPending}
          >
            <CreditCard className="size-4" />
            {portal.isPending ? "Abrindo..." : "Abrir portal de cobrança"}
          </Button>
        </section>
      )}

      {sub && (
        <section className="rounded-xl border border-destructive/30 bg-destructive/2 p-6">
          <header className="mb-5">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <AlertCircle className="size-4 text-destructive" />
              Cancelar assinatura
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Sua assinatura permanecerá ativa até o final do período já pago.
            </p>
          </header>
          {sub.cancelAtPeriodEnd ? (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-muted-foreground">
                Cancelamento agendado para {sub.periodEnd
                  ? format(new Date(sub.periodEnd), "d 'de' MMMM, yyyy", {
                      locale: ptBR,
                    })
                  : "o fim do período"}.
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => restore.mutate()}
                disabled={restore.isPending}
              >
                Reativar assinatura
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="gap-2 text-destructive hover:text-destructive"
              onClick={() => cancel.mutate()}
              disabled={cancel.isPending}
            >
              <XCircle className="size-4" />
              {cancel.isPending ? "Cancelando..." : "Cancelar assinatura"}
            </Button>
          )}
        </section>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CreditCard;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="text-base font-medium mt-1.5">{value}</div>
    </div>
  );
}
