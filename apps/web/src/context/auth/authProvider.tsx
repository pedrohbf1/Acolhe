import { AuthContext } from "./authContext";
import { useNavigate } from "react-router-dom";
import type { GetSessionResponse } from "@/service/auth/types";
import Loading from "@/components/loading";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SchemaLogin } from "@/schemas/auth/login";
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

      // ✅ se vier com error
      if ("error" in res && res.error) return null;

      // ✅ se vier com data
      if ("data" in res) return (res.data ?? null) as GetSessionResponse | null;

      // fallback
      return null;
    },
    retry: false,
  });

  const logout = async () => {
    await authClient.signOut(undefined, {
      onSuccess: async () => {
        queryClient.setQueryData(["session"], null);
        queryClient.invalidateQueries({ queryKey: ["session"] });
        navigate("/");
      },
    });
  };

  const login = async (data: SchemaLogin) => {
    await authClient.signIn.email(data, {
      onSuccess: async () => {
        queryClient.invalidateQueries({ queryKey: ["session"] });
        setLoading(false);
      },
      onError: (error) => {
        setLoading(false);
        toast.error(error.error.message);
      },
      onRequest: () => {
        setLoading(true);
      },
    });
  };

  const loadingState = isLoading || loading;

  if (loadingState) {
    return <Loading fullScreen />;
  }

  return (
    <AuthContext.Provider
      value={{
        user: user?.user ?? null,
        session: user?.session ?? null,
        isAuthenticated: !!user,
        refetchSession: () =>
          queryClient.invalidateQueries({ queryKey: ["session"] }),
        logout: async () => {
          logout();
        },
        login: (data: SchemaLogin) => {
          login(data);
        },
        setLoading: setLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
