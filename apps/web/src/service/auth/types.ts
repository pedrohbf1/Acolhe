export interface LoginInput {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface Session {
  id: string;
  token: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  activeOrganizationId?: string | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  /** "user" | "admin" | "super_admin" — vem do banco. */
  role?: string | null;
  /** Estado de banimento (super_admin baniu). */
  banned?: boolean | null;
  banReason?: string | null;
  banObservation?: string | null;
  banExpires?: string | null;
  bannedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GetSessionResponse {
  session: Session;
  user: User;
}
