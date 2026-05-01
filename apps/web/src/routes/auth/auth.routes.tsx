import DefaultAuthPage from "@/pages/auth/default";
import { Route, Routes } from "react-router-dom";
import { routesAuth } from "./routes.object";
import NotFoundPage from "@/pages/not-found";

export default function AuthRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DefaultAuthPage />}>
        {routesAuth.map((route) => (
          <Route key={route.path} path={route.path} element={route.element} />
        ))}
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
