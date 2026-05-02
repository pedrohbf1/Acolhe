import {
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  MessageSquare,
  Settings,
  Sparkles,
} from "lucide-react";

type Features = {
  canManageMembers: boolean;
  canManageRoles: boolean;
  canViewAuditLogs: boolean;
};

/**
 * Constrói a navegação respeitando as features do plano atual.
 * Solo (free/pro): vê só o essencial. Team: vê tudo.
 */
export function getSidebarConfig(features: Partial<Features> = {}) {
  const settingsChildren = [
    { title: "Perfil", url: "/configuracoes/perfil" },
    { title: "Organização", url: "/configuracoes/organizacao" },
    ...(features.canManageMembers
      ? [{ title: "Membros", url: "/configuracoes/membros" }]
      : []),
    ...(features.canManageRoles
      ? [{ title: "Cargos", url: "/configuracoes/cargos" }]
      : []),
    ...(features.canViewAuditLogs
      ? [{ title: "Logs", url: "/configuracoes/logs" }]
      : []),
  ];

  return {
    sidebarNav: [
      {
        title: "Plataforma",
        items: [
          { title: "Dashboard", url: "/", icon: LayoutDashboard },
          { title: "Planos", url: "/pricing", icon: Sparkles },
        ],
      },
      {
        title: "Sistema",
        items: [
          {
            title: "Configurações",
            icon: Settings,
            items: settingsChildren,
          },
          {
            title: "Cobrança",
            icon: CreditCard,
            url: "/configuracoes/billing",
          },
        ],
      },
      {
        title: "Suporte",
        items: [
          { title: "Ajuda", url: "/ajuda", icon: LifeBuoy },
          { title: "Feedback", url: "/feedback", icon: MessageSquare },
        ],
      },
    ],
  };
}
