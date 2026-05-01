import type { Routes } from "../type";
import DashboardPage from "@/pages/app/dashboard";

export const routesApp: Routes[] = [
  {
    path: "/",
    element: <DashboardPage />,
  },
];
