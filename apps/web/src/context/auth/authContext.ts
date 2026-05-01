import type { SchemaLogin } from "@/schemas/auth/login";
import type { Session, User } from "@/service/auth/types";
import { createContext } from "react";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  refetchSession: () => void;
  logout: () => Promise<void>;
  login: (data: SchemaLogin) => void;
  setLoading: (value: boolean) => void;
};

export const AuthContext = createContext<AuthContextType>(
  {} as AuthContextType,
);
