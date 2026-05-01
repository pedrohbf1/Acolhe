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
}

export interface User {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  role?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GetSessionResponse {
  session: Session;
  user: User;
}
