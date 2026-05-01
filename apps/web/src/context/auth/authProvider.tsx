import { AuthContext } from "./authContext";
import { useNavigate } from "react-router-dom";
import type { GetSessionResponse } from "@/service/auth/types";
import Loading from "@/components/loading";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SchemaLogin } from "@/schemas/auth/login";
import type { SchemaRegister } from "@/schemas/auth/register";
import type { SchemaForgotPassword } from "@/schemas/auth/forgot-password";
import type { SchemaResetPassword } from "@/schemas/auth/reset-password";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { useState } from "react";

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const { data: user, isLoading } = useQuery<GetSessionResponse | null>({
    queryKey: ["session"],
    queryFn: async () => {
      const res = await authClient.getSession();
      if ("error" in res && res.error) return null;
      if ("data" in res) return (res.data ?? null) as GetSessionResponse | null;
      return null;
    },
    retry: false,
  });

  const invalidateSession = () =>
    queryClient.invalidateQueries({ queryKey: ["session"] });

  // ─── login ─────────────────────────────────────────────────────────────────
  const login = async (data: SchemaLogin) => {
    setLoading(true);
    try {
      const res = await authClient.signIn.email(data);
      if ("error" in res && res.error) {
        toast.error(res.error.message ?? "Erro ao entrar");
        return;
      }
      await invalidateSession();
    } finally {
      setLoading(false);
    }
  };

  // ─── register ──────────────────────────────────────────────────────────────
  const register = async (data: SchemaRegister) => {
    setLoading(true);
    try {
      const res = await authClient.signUp.email({
        name: data.name,
        email: data.email,
        password: data.password,
      });
      if ("error" in res && res.error) {
        toast.error(res.error.message ?? "Erro ao cadastrar");
        return;
      }
      toast.success(
        "Conta criada! Enviamos um link de confirmação para o seu e-mail.",
      );
      navigate("/verify-email-sent", {
        state: { email: data.email },
      });
    } finally {
      setLoading(false);
    }
  };

  // ─── logout ────────────────────────────────────────────────────────────────
  const logout = async () => {
    await authClient.signOut(undefined, {
      onSuccess: async () => {
        queryClient.setQueryData(["session"], null);
        await invalidateSession();
        navigate("/");
      },
    });
  };

  // ─── forgot password ───────────────────────────────────────────────────────
  const forgotPassword = async (data: SchemaForgotPassword) => {
    setLoading(true);
    try {
      const res = await authClient.requestPasswordReset({
        email: data.email,
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if ("error" in res && res.error) {
        toast.error(res.error.message ?? "Erro ao enviar e-mail");
        return;
      }
      toast.success(
        "Se o e-mail existir, você receberá um link para redefinir sua senha.",
      );
    } finally {
      setLoading(false);
    }
  };

  // ─── reset password ────────────────────────────────────────────────────────
  const resetPassword = async (
    data: SchemaResetPassword & { token: string },
  ) => {
    setLoading(true);
    try {
      const res = await authClient.resetPassword({
        newPassword: data.password,
        token: data.token,
      });
      if ("error" in res && res.error) {
        toast.error(res.error.message ?? "Token inválido ou expirado");
        return;
      }
      toast.success("Senha redefinida com sucesso. Entre com a nova senha.");
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) return <Loading fullScreen />;

  return (
    <AuthContext.Provider
      value={{
        user: user?.user ?? null,
        session: user?.session ?? null,
        isAuthenticated: !!user,
        loading,
        refetchSession: invalidateSession,
        login,
        logout,
        register,
        forgotPassword,
        resetPassword,
        setLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
