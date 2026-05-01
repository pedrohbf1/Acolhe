import type { Routes } from "../type";
import LoginAuthPage from "@/pages/auth/login";

export const routesAuth: Routes[] = [
  {
    path: "/",
    element: <LoginAuthPage />,
  },
];
