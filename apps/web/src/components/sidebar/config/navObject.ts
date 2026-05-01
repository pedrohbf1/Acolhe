import {
  CreditCard,
  LayoutDashboard,
  Settings,
  Sparkles,
} from "lucide-react";

export const sidebarNav = [
  {
    title: "Plataforma",
    items: [
      {
        title: "Dashboard",
        url: "/",
        icon: LayoutDashboard,
      },
      {
        title: "Planos",
        url: "/pricing",
        icon: Sparkles,
      },
    ],
  },
  {
    title: "Sistema",
    items: [
      {
        title: "Configurações",
        icon: Settings,
        items: [
          { title: "Perfil", url: "/configuracoes/perfil" },
          { title: "Organização", url: "/configuracoes/organizacao" },
          { title: "Membros", url: "/configuracoes/membros" },
          { title: "Assinatura", url: "/configuracoes/billing" },
        ],
      },
      {
        title: "Cobrança",
        icon: CreditCard,
        url: "/configuracoes/billing",
      },
    ],
  },
];
