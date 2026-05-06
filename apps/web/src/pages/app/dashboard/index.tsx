import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useActiveOrganization } from "@/hooks/useOrganizations";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import {
  ArrowRight,
  Building2,
  CreditCard,
  Sparkles,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: activeOrg } = useActiveOrganization();
  const features = usePlanFeatures();
  // planDisplay já leva o custom plan pago em conta.
  const plan = features.planDisplay;

  const memberCount = activeOrg?.members?.length ?? 1;
  const PlanIcon = plan.icon;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Olá, {user?.name?.split(" ")[0] ?? "bem-vindo"} 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Aqui está um resumo do que está rolando no useAcolhe.
        </p>
      </div>

      <div
        className={`grid gap-4 ${features.isTeamPlan ? "md:grid-cols-3" : "md:grid-cols-2"}`}
      >
        {features.isTeamPlan && (
          <Card
            icon={Building2}
            label="Organização ativa"
            value={activeOrg?.name ?? "—"}
            to="/configuracoes/organizacao"
          />
        )}
        {features.isTeamPlan && (
          <Card
            icon={Users}
            label="Membros"
            value={String(memberCount)}
            to="/configuracoes/membros"
          />
        )}
        <Card
          icon={PlanIcon}
          label="Plano"
          value={plan.label}
          to="/configuracoes/billing"
        />
        {!features.isTeamPlan && (
          <Card
            icon={Sparkles}
            label="Quer time?"
            value="Conheça o Team"
            to="/pricing"
          />
        )}
      </div>

      <section className="rounded-xl border bg-linear-to-br from-primary/8 via-primary/3 to-secondary/10 p-6">
        <div className="flex items-start gap-4">
          <div className="size-12 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
            <Sparkles className="size-6 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Validar end-to-end</h2>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Atalhos rápidos pros principais fluxos.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link to="/pricing">
                <Button variant="default" size="sm" className="gap-2">
                  Ver planos <ArrowRight className="size-4" />
                </Button>
              </Link>
              {features.canManageMembers && (
                <Link to="/configuracoes/membros">
                  <Button variant="outline" size="sm" className="gap-2">
                    Convidar membro <ArrowRight className="size-4" />
                  </Button>
                </Link>
              )}
              <Link to="/configuracoes/billing">
                <Button variant="outline" size="sm" className="gap-2">
                  Gerenciar billing <CreditCard className="size-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Card({
  icon: Icon,
  label,
  value,
  to,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-xl border bg-card p-5 hover:border-primary/40 hover:shadow-sm transition-all"
    >
      <div className="flex items-center justify-between">
        <div className="size-9 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
          <Icon className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
        <ArrowRight className="size-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
      </div>
      <div className="mt-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">
          {label}
        </div>
        <div className="text-lg font-semibold mt-1 truncate">{value}</div>
      </div>
    </Link>
  );
}
