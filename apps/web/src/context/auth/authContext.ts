import type { SchemaForgotPassword } from "@/schemas/auth/forgot-password";
import type { SchemaLogin } from "@/schemas/auth/login";
import type { SchemaRegister } from "@/schemas/auth/register";
import type { SchemaResetPassword } from "@/schemas/auth/reset-password";
import type { Session, User } from "@/service/auth/types";
import { createContext } from "react";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  loading: boolean;
  refetchSession: () => void;
  login: (data: SchemaLogin) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: SchemaRegister) => Promise<void>;
  forgotPassword: (data: SchemaForgotPassword) => Promise<void>;
  resetPassword: (data: SchemaResetPassword & { token: string }) => Promise<void>;
  setLoading: (value: boolean) => void;
};

export const AuthContext = createContext<AuthContextType>(
  {} as AuthContextType,
);
