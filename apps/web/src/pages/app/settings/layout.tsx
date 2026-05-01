import { cn } from "@/lib/utils";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import {
  Building2,
  CreditCard,
  ListChecks,
  Scroll,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

export default function SettingsLayout() {
  const features = usePlanFeatures();

  const tabs = [
    { to: "/configuracoes/perfil", label: "Perfil", icon: User, show: true },
    {
      to: "/configuracoes/organizacao",
      label: "Organização",
      icon: Building2,
      show: true,
    },
    {
      to: "/configuracoes/membros",
      label: "Membros",
      icon: Users,
      show: features.canManageMembers,
    },
    {
      to: "/configuracoes/cargos",
      label: "Cargos",
      icon: ShieldCheck,
      show: features.canManageRoles,
    },
    {
      to: "/configuracoes/logs",
      label: "Logs",
      icon: Scroll,
      show: features.canViewAuditLogs,
    },
    {
      to: "/configuracoes/billing",
      label: "Assinatura",
      icon: CreditCard,
      show: true,
    },
  ].filter((t) => t.show);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie seu perfil, organização e assinatura.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="flex lg:flex-col gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <NavLink
                key={t.to}
                to={t.to}
                end
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                    isActive
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )
                }
              >
                <Icon className="size-4" />
                {t.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="min-w-0">
          <Outlet />
        </div>
      </div>

      {!features.isTeamPlan && (
        <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
          <ListChecks className="size-4 mt-0.5 text-primary" />
          <div>
            <strong>Trabalha em equipe?</strong> O plano <strong>Team</strong>{" "}
            libera múltiplas organizações, convites de membros, cargos
            personalizados e logs de auditoria.{" "}
            <NavLink to="/pricing" className="text-primary hover:underline">
              Ver planos
            </NavLink>
          </div>
        </div>
      )}
    </div>
  );
}
