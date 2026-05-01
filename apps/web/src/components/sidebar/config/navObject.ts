import { LayoutDashboard, Settings } from "lucide-react";

export const sidebarNav = [
  {
    title: "Plataforma",
    items: [
      {
        title: "Dashboard",
        url: "/",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    title: "Sistema",
    items: [
      {
        title: "Configurações",
        icon: Settings,
        url: "/configuracoes",
      },
    ],
  },
];
