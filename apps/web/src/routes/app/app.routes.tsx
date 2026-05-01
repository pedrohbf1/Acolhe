import { Route, Routes, Navigate } from "react-router-dom";
import { routesApp } from "./routes.object";
import DefaultAppPage from "@/pages/app/default";
import NotFoundPage from "@/pages/not-found";
import { useAuth } from "@/hooks/useAuth";

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DefaultAppPage />}>
        {routesApp.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={
              route.adminOnly ? (
                <AdminGuard>{route.element}</AdminGuard>
              ) : (
                route.element
              )
            }
          />
        ))}
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
