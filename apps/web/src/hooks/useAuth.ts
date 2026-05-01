import { useContext } from "react";
import { AuthContext } from "@/context/auth/authContext";

export function useAuth() {
  const ctx = useContext(AuthContext);
  return {
    ...ctx,
    isAdmin: ctx.user?.role === "admin",
  };
}
