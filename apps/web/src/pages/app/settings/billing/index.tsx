import { Button } from "@/components/ui/button";
import { useBillingSummary, type InvoiceSummary } from "@/hooks/useBillingSummary";
import { authClient } from "@/lib/auth-client";
import { getPlanDisplay, PLANS_DISPLAY, type PlanName } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { differenceInCalendarDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  ArrowUpRight,
  CalendarClock,
  Check,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Hourglass,
  Loader2,
  Receipt,
  Rocket,
  Sparkles,
  Users,
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

function formatBRLFromReais(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
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

  // Trial countdown
  const trialDaysLeft =
    sub?.status === "trialing" && sub.trialEnd
      ? Math.max(0, differenceInCalendarDays(new Date(sub.trialEnd), new Date()))
      : null;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header da página ─────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cobrança</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Plano, forma de pagamento e histórico de faturas.
        </p>
      </div>

      {/* ── Banner pós-checkout ──────────────────────────────── */}
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

      {/* ── Hero do plano ───────────────────────────────────── */}
      {sub ? (
        <ActivePlanHero
          plan={plan}
          sub={sub}
          trialDaysLeft={trialDaysLeft}
        />
      ) : (
        <FreePlanHero />
      )}

      {/* ── Stats: próxima cobrança / período / limites ─────── */}
      {sub && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat
            icon={CalendarClock}
            label={
              sub.cancelAtPeriodEnd
                ? "Cancela em"
                : trialDaysLeft != null
                ? "Trial termina em"
                : "Próxima cobrança"
            }
            value={
              sub.periodEnd
                ? format(new Date(sub.periodEnd), "d 'de' MMM, yyyy", {
                    locale: ptBR,
                  })
                : "—"
            }
            sub={
              !sub.cancelAtPeriodEnd && plan.priceMonthlyBRL
                ? formatBRLFromReais(plan.priceMonthlyBRL)
                : undefined
            }
          />
          <Stat
            icon={Receipt}
            label="Período atual"
            value={
              sub.periodStart && sub.periodEnd
                ? `${format(new Date(sub.periodStart), "d MMM", { locale: ptBR })} – ${format(new Date(sub.periodEnd), "d MMM", { locale: ptBR })}`
                : "—"
            }
            sub={
              sub.periodStart
                ? format(new Date(sub.periodStart), "yyyy", { locale: ptBR })
                : undefined
            }
          />
          <Stat
            icon={Users}
            label="Limites do plano"
            value={`${plan.limits.maxOrganizations} ${plan.limits.maxOrganizations === 1 ? "org" : "orgs"} · ${plan.limits.maxPatients} pacientes`}
          />
        </div>
      )}

      {/* ── Forma de pagamento ──────────────────────────────── */}
      {sub && (
        <section className="rounded-xl border bg-card p-6">
          <header className="flex items-start justify-between gap-4 flex-wrap mb-5">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <CreditCard className="size-4 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Forma de pagamento</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Cartão usado para cobrar a assinatura.
                </p>
              </div>
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
            <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
              <div className="size-10 rounded-md bg-background flex items-center justify-center shrink-0">
                <CreditCard className="size-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium capitalize">
                  {data.paymentMethod.brand} •••• {data.paymentMethod.last4}
                </div>
                <div className="text-xs text-muted-foreground">
                  Expira em{" "}
                  {String(data.paymentMethod.expMonth).padStart(2, "0")}/
                  {data.paymentMethod.expYear}
                </div>
              </div>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-primary/15 text-primary tracking-wide shrink-0">
                PADRÃO
              </span>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhum cartão cadastrado.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 gap-2"
                onClick={() => portal.mutate()}
                disabled={portal.isPending}
              >
                Adicionar cartão <ExternalLink className="size-3.5" />
              </Button>
            </div>
          )}
        </section>
      )}

      {/* ── Histórico de faturas ────────────────────────────── */}
      {sub && data?.invoices && data.invoices.length > 0 && (
        <section className="rounded-xl border bg-card overflow-hidden">
          <header className="p-6 border-b">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="size-4 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Histórico de faturas</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Últimas {data.invoices.length}{" "}
                  {data.invoices.length === 1 ? "cobrança" : "cobranças"}.
                </p>
              </div>
            </div>
          </header>
          <ul className="divide-y divide-border">
            {data.invoices.map((inv) => (
              <InvoiceRow key={inv.id} invoice={inv} />
            ))}
          </ul>
        </section>
      )}

      {/* ── Cancelar / Restaurar ────────────────────────────── */}
      {sub && (
        <section className="rounded-xl border border-destructive/30 bg-destructive/2 p-6">
          <header className="mb-5">
            <h2 className="text-base font-semibold flex items-center gap-2 text-destructive">
              <AlertCircle className="size-4" />
              Cancelar assinatura
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Sua assinatura permanece ativa até o fim do período já pago.
              {sub.periodEnd && (
                <>
                  {" "}
                  Acesso liberado até{" "}
                  <strong>
                    {format(new Date(sub.periodEnd), "d 'de' MMMM, yyyy", {
                      locale: ptBR,
                    })}
                  </strong>
                  .
                </>
              )}
            </p>
          </header>
          {sub.cancelAtPeriodEnd ? (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
                <Hourglass className="size-3.5" />
                Cancelamento agendado
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => restore.mutate()}
                disabled={restore.isPending}
              >
                {restore.isPending ? "Reativando..." : "Reativar assinatura"}
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

// ─── Hero: plano ativo ───────────────────────────────────────────────────────

function ActivePlanHero({
  plan,
  sub,
  trialDaysLeft,
}: {
  plan: ReturnType<typeof getPlanDisplay>;
  sub: NonNullable<ReturnType<typeof useBillingSummary>["data"]>["subscription"];
  trialDaysLeft: number | null;
}) {
  if (!sub) return null;
  const PlanIcon = plan.icon;

  return (
    <section className="relative overflow-hidden rounded-2xl border bg-linear-to-br from-primary/10 via-card to-card p-6 sm:p-7">
      {/* decoração */}
      <div className="absolute -top-12 -right-12 size-48 rounded-full bg-primary/15 blur-3xl pointer-events-none" />

      <div className="relative flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="size-12 rounded-2xl bg-primary/15 flex items-center justify-center">
            <PlanIcon className="size-6 text-primary" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              Plano atual
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <h2 className="text-2xl font-bold tracking-tight">
                {plan.label}
              </h2>
              {plan.priceMonthlyBRL ? (
                <span className="text-sm text-muted-foreground">
                  {formatBRLFromReais(plan.priceMonthlyBRL)}/mês
                </span>
              ) : null}
            </div>
            <div className="mt-2">
              <StatusBadge sub={sub} trialDaysLeft={trialDaysLeft} />
            </div>
          </div>
        </div>

        <Link to="/pricing">
          <Button variant="outline" className="gap-2">
            Mudar de plano
            <ArrowUpRight className="size-4" />
          </Button>
        </Link>
      </div>

      {/* features incluídas */}
      <ul className="relative mt-6 grid gap-2 sm:grid-cols-2">
        {plan.features.map((f) => (
          <li
            key={f}
            className="text-sm text-muted-foreground flex items-center gap-2"
          >
            <Check className="size-3.5 text-primary shrink-0" />
            {f}
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatusBadge({
  sub,
  trialDaysLeft,
}: {
  sub: NonNullable<ReturnType<typeof useBillingSummary>["data"]>["subscription"];
  trialDaysLeft: number | null;
}) {
  if (!sub) return null;
  if (sub.cancelAtPeriodEnd) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 font-medium">
        <Hourglass className="size-3" />
        Cancelamento agendado
      </span>
    );
  }
  if (sub.status === "trialing") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 font-medium">
        <Hourglass className="size-3" />
        {trialDaysLeft != null
          ? `${trialDaysLeft} ${trialDaysLeft === 1 ? "dia" : "dias"} de trial`
          : "Em trial"}
      </span>
    );
  }
  if (sub.status === "past_due") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-destructive/15 text-destructive font-medium">
        <AlertCircle className="size-3" />
        Pagamento em atraso
      </span>
    );
  }
  if (sub.status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-medium">
        <Check className="size-3" />
        Assinatura ativa
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground font-medium capitalize">
      {sub.status}
    </span>
  );
}

// ─── Hero: plano free / sem assinatura ───────────────────────────────────────

function FreePlanHero() {
  const free = getPlanDisplay("free");
  const upgradePlans = PLANS_DISPLAY.filter(
    (p) => p.name !== "free",
  ) as Array<(typeof PLANS_DISPLAY)[number] & { name: Exclude<PlanName, "free"> }>;
  const FreeIcon = free.icon;

  return (
    <>
      <section className="relative overflow-hidden rounded-2xl border bg-linear-to-br from-muted/40 via-card to-card p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-2xl bg-muted flex items-center justify-center">
              <FreeIcon className="size-6 text-muted-foreground" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                Plano atual
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <h2 className="text-2xl font-bold tracking-tight">Free</h2>
                <span className="text-sm text-muted-foreground">
                  Grátis para sempre
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-2 max-w-md">
                Você está usando o Free. Faça upgrade para desbloquear mais
                organizações, equipe e auditoria.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        {upgradePlans.map((p) => (
          <UpgradeCard key={p.name} plan={p} />
        ))}
      </div>
    </>
  );
}

function UpgradeCard({
  plan,
}: {
  plan: (typeof PLANS_DISPLAY)[number] & { name: Exclude<PlanName, "free"> };
}) {
  const Icon = plan.icon;
  return (
    <Link
      to="/pricing"
      className={cn(
        "group rounded-xl border bg-card p-5 transition-all hover:shadow-md",
        plan.highlight
          ? "border-primary/40 hover:border-primary/60"
          : "hover:border-primary/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "size-10 rounded-xl flex items-center justify-center",
              plan.highlight ? "bg-primary/15" : "bg-muted",
            )}
          >
            <Icon
              className={cn(
                "size-5",
                plan.highlight ? "text-primary" : "text-muted-foreground",
              )}
            />
          </div>
          <div>
            <div className="text-base font-semibold flex items-center gap-2">
              {plan.label}
              {plan.highlight && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-primary text-primary-foreground tracking-wide">
                  POPULAR
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">{plan.tagline}</div>
          </div>
        </div>
        <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
      </div>

      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-2xl font-bold">
          {plan.priceMonthlyBRL
            ? formatBRLFromReais(plan.priceMonthlyBRL)
            : "Grátis"}
        </span>
        {plan.priceMonthlyBRL ? (
          <span className="text-xs text-muted-foreground">/mês</span>
        ) : null}
      </div>
      {plan.trialDays > 0 && (
        <p className="text-xs text-primary mt-1 inline-flex items-center gap-1">
          <Rocket className="size-3" />
          {plan.trialDays} dias grátis para testar
        </p>
      )}

      <ul className="mt-4 space-y-1.5">
        {plan.features.slice(0, 3).map((f) => (
          <li
            key={f}
            className="text-xs text-muted-foreground flex items-center gap-2"
          >
            <Check className="size-3 text-primary shrink-0" />
            {f}
          </li>
        ))}
      </ul>
    </Link>
  );
}

// ─── Componentes auxiliares ──────────────────────────────────────────────────

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof CreditCard;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="text-base font-semibold mt-2 truncate">{value}</div>
      {sub && (
        <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
      )}
    </div>
  );
}

function InvoiceRow({ invoice }: { invoice: InvoiceSummary }) {
  const status = STATUS_LABELS[invoice.status ?? "open"] ?? {
    label: invoice.status ?? "—",
    color: "text-muted-foreground",
  };
  return (
    <li className="flex items-center justify-between gap-4 px-6 py-4 flex-wrap hover:bg-muted/30 transition-colors">
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
