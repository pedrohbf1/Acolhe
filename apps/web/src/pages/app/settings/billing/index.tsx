import { Button } from "@/components/ui/button";
import { useBillingSummary, type InvoiceSummary } from "@/hooks/useBillingSummary";
import { authClient } from "@/lib/auth-client";
import { getPlanDisplay } from "@/lib/plans";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  ArrowUpRight,
  CalendarClock,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

function formatBRL(cents: number, currency = "BRL") {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: currency.toUpperCase(),
  });
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  paid: { label: "Pago", color: "text-emerald-600 dark:text-emerald-400" },
  open: { label: "Em aberto", color: "text-amber-600 dark:text-amber-400" },
  void: { label: "Cancelada", color: "text-muted-foreground" },
  uncollectible: { label: "Não cobrável", color: "text-muted-foreground" },
  draft: { label: "Rascunho", color: "text-muted-foreground" },
};

export default function BillingSettingsPage() {
  const [params, setParams] = useSearchParams();
  const justSubscribed = params.get("success") === "1";

  const { data, isLoading } = useBillingSummary({
    pollUntilSubscription: justSubscribed,
  });
  const qc = useQueryClient();

  // Quando a assinatura aparece após checkout, limpa o ?success=1 e refresca caches.
  useEffect(() => {
    if (justSubscribed && data?.subscription) {
      const t = setTimeout(() => {
        setParams({}, { replace: true });
        qc.invalidateQueries({ queryKey: ["subscriptions"] });
        qc.invalidateQueries({ queryKey: ["session"] });
      }, 800);
      return () => clearTimeout(t);
    }
  }, [justSubscribed, data?.subscription, setParams, qc]);

  const sub = data?.subscription ?? null;
  const plan = getPlanDisplay(sub?.plan);

  const portal = useMutation({
    mutationFn: async () => {
      const res = await authClient.subscription.billingPortal({
        returnUrl: `${window.location.origin}/configuracoes/billing`,
      });
      if ("error" in res && res.error) throw new Error(res.error.message);
      const out = "data" in res ? res.data : null;
      if (out && typeof out === "object" && "url" in out && out.url) {
        window.location.href = out.url as string;
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
    onSuccess: () => {
      toast.success("Assinatura cancelada.");
      qc.invalidateQueries({ queryKey: ["billing"] });
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const restore = useMutation({
    mutationFn: async () => {
      const res = await authClient.subscription.restore();
      if ("error" in res && res.error) throw new Error(res.error.message);
    },
    onSuccess: () => {
      toast.success("Assinatura restaurada.");
      qc.invalidateQueries({ queryKey: ["billing"] });
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Carregando…
      </div>
    );
  }

  // Banner de processamento pós-checkout (webhook ainda não chegou)
  if (justSubscribed && !sub) {
    return <PostCheckoutWaiting />;
  }

  const PlanIcon = plan.icon;

  return (
    <div className="flex flex-col gap-8">
      {justSubscribed && sub && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
          <Sparkles className="size-5 text-primary shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-sm">Pagamento confirmado!</div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Bem-vindo ao plano {plan.label}. Seus novos limites já estão
              ativos.
            </p>
          </div>
        </div>
      )}

      {/* ─── Plano atual ─── */}
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
                <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Em período de avaliação
                </div>
              )}
              {sub?.status === "past_due" && (
                <div className="text-xs text-destructive mt-1">
                  Pagamento em atraso — atualize seu cartão
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
          <div className="grid gap-4 sm:grid-cols-3 mt-6">
            <Stat
              icon={CalendarClock}
              label={
                sub.cancelAtPeriodEnd ? "Cancelamento em" : "Próxima cobrança"
              }
              value={
                sub.periodEnd
                  ? format(new Date(sub.periodEnd), "d 'de' MMM, yyyy", {
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
                  : sub.status === "past_due"
                  ? "Em atraso"
                  : sub.status
              }
            />
            <Stat
              icon={Sparkles}
              label="Limites"
              value={`${plan.limits.maxOrganizations} org${plan.limits.maxOrganizations > 1 ? "s" : ""} · ${plan.limits.maxPatients} pacientes`}
            />
          </div>
        ) : (
          <div className="rounded-lg bg-muted/30 p-4 mt-2 text-sm text-muted-foreground">
            Você está no plano <strong>Free</strong>. Faça upgrade para
            desbloquear mais organizações, equipe e auditoria.
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

      {/* ─── Forma de pagamento ─── */}
      {sub && (
        <section className="rounded-xl border bg-card p-6">
          <header className="flex items-start justify-between gap-4 flex-wrap mb-5">
            <div>
              <h2 className="text-base font-semibold flex items-center gap-2">
                <CreditCard className="size-4" />
                Forma de pagamento
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Cartão usado para cobrar a assinatura.
              </p>
            </div>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => portal.mutate()}
              disabled={portal.isPending}
            >
              {portal.isPending ? "Abrindo..." : "Gerenciar"}
              <ExternalLink className="size-4" />
            </Button>
          </header>

          {data?.paymentMethod ? (
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-md bg-muted flex items-center justify-center">
                <CreditCard className="size-5 text-muted-foreground" />
              </div>
              <div>
                <div className="text-sm font-medium capitalize">
                  {data.paymentMethod.brand} •••• {data.paymentMethod.last4}
                </div>
                <div className="text-xs text-muted-foreground">
                  Expira em{" "}
                  {String(data.paymentMethod.expMonth).padStart(2, "0")}/
                  {data.paymentMethod.expYear}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Nenhum cartão cadastrado.
            </div>
          )}
        </section>
      )}

      {/* ─── Histórico de faturas ─── */}
      {sub && data?.invoices && data.invoices.length > 0 && (
        <section className="rounded-xl border bg-card overflow-hidden">
          <header className="p-6 border-b">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <FileText className="size-4" />
              Histórico de faturas
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Últimas {data.invoices.length} cobranças.
            </p>
          </header>
          <ul className="divide-y divide-border">
            {data.invoices.map((inv) => (
              <InvoiceRow key={inv.id} invoice={inv} />
            ))}
          </ul>
        </section>
      )}

      {/* ─── Cancelar / Restaurar ─── */}
      {sub && (
        <section className="rounded-xl border border-destructive/30 bg-destructive/2 p-6">
          <header className="mb-5">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <AlertCircle className="size-4 text-destructive" />
              Cancelar assinatura
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Sua assinatura permanece ativa até o fim do período já pago.
            </p>
          </header>
          {sub.cancelAtPeriodEnd ? (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-muted-foreground">
                Cancelamento agendado para{" "}
                {sub.periodEnd
                  ? format(new Date(sub.periodEnd), "d 'de' MMMM, yyyy", {
                      locale: ptBR,
                    })
                  : "o fim do período"}
                .
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

// ─── Componentes auxiliares ──────────────────────────────────────────────────

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

function InvoiceRow({ invoice }: { invoice: InvoiceSummary }) {
  const status = STATUS_LABELS[invoice.status ?? "open"] ?? {
    label: invoice.status ?? "—",
    color: "text-muted-foreground",
  };
  return (
    <li className="flex items-center justify-between gap-4 px-6 py-4 flex-wrap">
      <div className="flex items-center gap-4 min-w-0">
        <div className="size-9 rounded-md bg-muted flex items-center justify-center shrink-0">
          <FileText className="size-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">
            {invoice.number ?? invoice.id}
          </div>
          <div className="text-xs text-muted-foreground">
            {format(new Date(invoice.createdAt), "d 'de' MMMM, yyyy", {
              locale: ptBR,
            })}
            {" · "}
            <span className={status.color}>{status.label}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-sm font-semibold">
          {formatBRL(invoice.amountPaid, invoice.currency)}
        </div>
        {invoice.pdfUrl && (
          <a
            href={invoice.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Baixar PDF"
          >
            <Download className="size-4" />
          </a>
        )}
        {invoice.hostedUrl && (
          <a
            href={invoice.hostedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Ver fatura"
          >
            <ExternalLink className="size-4" />
          </a>
        )}
      </div>
    </li>
  );
}

function PostCheckoutWaiting() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 gap-4">
      <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Loader2 className="size-6 text-primary animate-spin" />
      </div>
      <div>
        <h2 className="text-lg font-semibold">Confirmando seu pagamento…</h2>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">
          Estamos aguardando a confirmação da Stripe. Pode levar até 30
          segundos. A página atualiza sozinha quando pronto.
        </p>
      </div>
      <p className="text-xs text-muted-foreground/80 max-w-md">
        Se demorar mais que isso em dev local, verifique se o
        <code className="mx-1 px-1 py-0.5 rounded bg-muted">stripe listen</code>
        está rodando em outro terminal.
      </p>
    </div>
  );
}
