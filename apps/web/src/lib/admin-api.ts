/**
 * Cliente fino pro painel super_admin.
 *
 * Convenções:
 *   - Sempre `credentials: "include"` (precisa do cookie better-auth + cookie master).
 *   - 423 = "destrancado precisa" → joga AdminLockedError pra UI pedir passphrase.
 *   - 404 = rota fingida, serve pra esconder existência do painel pra
 *     usuários não-super_admin.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3333';

export class AdminLockedError extends Error {
  constructor() {
    super('Locked');
    this.name = 'AdminLockedError';
  }
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 423) {
    throw new AdminLockedError();
  }
  if (!res.ok) {
    const text = await res.text();
    let msg = `Erro ${res.status}`;
    try {
      const data = JSON.parse(text);
      if (data?.error) msg = data.error;
    } catch {
      if (text) msg = text;
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export interface AdminStatus {
  isSuperAdmin: boolean;
  unlocked: boolean;
}

export interface AdminStats {
  users: number;
  orgs: number;
  bannedUsers: number;
  bannedOrgs: number;
  feedbacks: number;
  newFeedbacks: number;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string | null;
  banned: boolean | null;
  banReason: string | null;
  banObservation: string | null;
  banExpires: string | null;
  bannedAt: string | null;
  createdAt: string;
  customPlan: {
    id: string;
    name: string;
    monthlyPriceBRL: number;
    stripeStatus: string | null;
  } | null;
  _count: { members: number; feedbacks: number };
}

export interface AdminOrg {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  banned: boolean;
  banReason: string | null;
  banObservation: string | null;
  bannedAt: string | null;
  createdAt: string;
  _count: { members: number; invitations: number; auditLogs: number };
}

export interface AdminCustomPlan {
  id: string;
  userId: string;
  user: { id: string; name: string; email: string; image: string | null };
  name: string;
  notes: string | null;
  monthlyPriceBRL: number;
  yearlyPriceBRL: number | null;
  maxOrganizations: number;
  maxPatients: number;
  maxMembers: number;
  auditLog: boolean;
  customRoles: boolean;
  stripeProductId: string;
  stripePriceMonthly: string;
  stripePriceYearly: string | null;
  stripeSubscriptionId: string | null;
  stripeStatus: string | null;
  createdAt: string;
}

export interface AdminFeedback {
  id: string;
  userId: string;
  type: string;
  subject: string;
  message: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; image: string | null };
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Endpoints ──────────────────────────────────────────────────────────────

export const adminApi = {
  status: () => request<AdminStatus>('GET', '/admin/status'),
  unlock: (passphrase: string) =>
    request<{ ok: true; expiresAt: string }>('POST', '/admin/unlock', {
      passphrase,
    }),
  lock: () => request<{ ok: true }>('POST', '/admin/lock'),
  stats: () => request<AdminStats>('GET', '/admin/stats'),

  // Users
  listUsers: (params: { page: number; limit: number; search?: string }) => {
    const qs = new URLSearchParams({
      page: String(params.page),
      limit: String(params.limit),
      ...(params.search ? { search: params.search } : {}),
    });
    return request<Paginated<AdminUser>>('GET', `/admin/users?${qs}`);
  },
  banUser: (
    userId: string,
    body: { reason: string; observation?: string; expiresAt?: string },
  ) => request<{ ok: true }>('POST', `/admin/users/${userId}/ban`, body),
  unbanUser: (userId: string) =>
    request<{ ok: true }>('POST', `/admin/users/${userId}/unban`),

  // Orgs
  listOrgs: (params: { page: number; limit: number; search?: string }) => {
    const qs = new URLSearchParams({
      page: String(params.page),
      limit: String(params.limit),
      ...(params.search ? { search: params.search } : {}),
    });
    return request<Paginated<AdminOrg>>('GET', `/admin/organizations?${qs}`);
  },
  banOrg: (
    orgId: string,
    body: { reason: string; observation?: string },
  ) =>
    request<{ ok: true }>('POST', `/admin/organizations/${orgId}/ban`, body),
  unbanOrg: (orgId: string) =>
    request<{ ok: true }>('POST', `/admin/organizations/${orgId}/unban`),

  // Custom plans (1:1 com user, integra com Stripe)
  listCustomPlans: () =>
    request<AdminCustomPlan[]>('GET', '/admin/custom-plans'),
  createCustomPlan: (body: {
    userId: string;
    name: string;
    notes?: string;
    monthlyPriceBRL: number;
    yearlyPriceBRL?: number;
    maxOrganizations: number;
    maxPatients: number;
    maxMembers: number;
    auditLog: boolean;
    customRoles: boolean;
  }) => request<AdminCustomPlan>('POST', '/admin/custom-plans', body),
  deleteCustomPlan: (id: string) =>
    request<{ ok: true }>('DELETE', `/admin/custom-plans/${id}`),

  // Feedbacks
  listFeedbacks: (params: {
    page: number;
    limit: number;
    status?: string;
    type?: string;
  }) => {
    const qs = new URLSearchParams({
      page: String(params.page),
      limit: String(params.limit),
      ...(params.status ? { status: params.status } : {}),
      ...(params.type ? { type: params.type } : {}),
    });
    return request<Paginated<AdminFeedback>>('GET', `/admin/feedbacks?${qs}`);
  },
  updateFeedback: (
    id: string,
    body: { status: string; adminNote?: string },
  ) => request<AdminFeedback>('PUT', `/admin/feedbacks/${id}`, body),
};
