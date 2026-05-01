import { cn } from "@/lib/utils";
import { Building2, CreditCard, User, Users } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

const tabs = [
  { to: "/configuracoes/perfil", label: "Perfil", icon: User },
  { to: "/configuracoes/organizacao", label: "Organização", icon: Building2 },
  { to: "/configuracoes/membros", label: "Membros", icon: Users },
  { to: "/configuracoes/billing", label: "Assinatura", icon: CreditCard },
];

export default function SettingsLayout() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie seu perfil, organização, membros e assinatura.
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
    </div>
  );
}
