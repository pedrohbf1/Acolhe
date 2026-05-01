import { Route, Routes, Navigate } from "react-router-dom";
import { routesApp } from "./routes.object";
import DefaultAppPage from "@/pages/app/default";
import NotFoundPage from "@/pages/not-found";
import { useAuth } from "@/hooks/useAuth";
import type { Routes as AppRoute } from "../type";

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function renderRoute(route: AppRoute) {
  const element = route.adminOnly ? (
    <AdminGuard>{route.element}</AdminGuard>
  ) : (
    route.element
  );

  if (route.children?.length) {
    return (
      <Route key={route.path} path={route.path} element={element}>
        {route.children.map(renderRoute)}
      </Route>
    );
  }
  return <Route key={route.path} path={route.path} element={element} />;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DefaultAppPage />}>
        {routesApp.map(renderRoute)}
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
