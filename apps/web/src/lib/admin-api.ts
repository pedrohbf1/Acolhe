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

export interface AdminAuditLog {
  id: string;
  userId: string;
  organizationId: string | null;
  action: string;
  resource: string;
  resourceId: string;
  metadata: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; image: string | null };
  organization: { id: string; name: string; slug: string } | null;
}

export interface AdminAuditFilterOptions {
  actions: Array<{ value: string; count: number }>;
  resources: Array<{ value: string; count: number }>;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Endpoints ──────────────────────────────────────────────────────────────

// ─── Detail types (drawer no painel) ────────────────────────────────────────

export interface AdminOrgRef {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  banned: boolean;
  createdAt: string;
  _count: { members: number; invitations: number };
}

export interface AdminMemberRow {
  id: string;
  role: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    banned?: boolean | null;
    customPlan?: {
      id: string;
      name: string;
      monthlyPriceBRL: number;
      stripeStatus: string | null;
    } | null;
  };
}

export interface AdminUserDetails {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  role: string | null;
  banned: boolean | null;
  banReason: string | null;
  banObservation: string | null;
  banExpires: string | null;
  bannedAt: string | null;
  bannedById: string | null;
  createdAt: string;
  stripeCustomerId: string | null;
  twoFactorEnabled: boolean | null;
  customPlan: AdminCustomPlan | null;
  members: Array<{
    id: string;
    role: string;
    createdAt: string;
    organization: AdminOrgRef & { members: AdminMemberRow[] };
  }>;
  subscriptions: Array<{
    id: string;
    plan: string;
    status: string;
    periodStart: string | null;
    periodEnd: string | null;
    cancelAtPeriodEnd: boolean | null;
    trialStart: string | null;
    trialEnd: string | null;
    stripeSubscriptionId: string | null;
  }>;
  recentAuditLogs: Array<{
    id: string;
    action: string;
    resource: string;
    resourceId: string;
    organizationId: string | null;
    createdAt: string;
    metadata: unknown;
  }>;
  recentFeedbacks: Array<{
    id: string;
    type: string;
    subject: string;
    message: string;
    status: string;
    createdAt: string;
  }>;
  activeSessions: number;
  lastSession: {
    createdAt: string;
    ipAddress: string | null;
    userAgent: string | null;
  } | null;
  _count: { feedbacks: number; auditLogs: number; invitations: number };
}

export interface AdminOrgDetails extends AdminOrg {
  members: AdminMemberRow[];
  invitations: Array<{
    id: string;
    email: string;
    role: string | null;
    status: string;
    createdAt: string;
    expiresAt: string;
    inviter: { id: string; name: string; email: string; image: string | null };
  }>;
  organizationRoles: Array<{
    id: string;
    role: string;
    permission: string;
    createdAt: string;
  }>;
  ownerSubscriptions: Array<{
    id: string;
    plan: string;
    status: string;
    periodStart: string | null;
    periodEnd: string | null;
    cancelAtPeriodEnd: boolean | null;
    stripeSubscriptionId: string | null;
  }>;
  recentAuditLogs: Array<{
    id: string;
    action: string;
    resource: string;
    resourceId: string;
    createdAt: string;
    user: { id: string; name: string; email: string; image: string | null };
  }>;
}

export interface AdminRichStats {
  users: number;
  verifiedUsers: number;
  orgs: number;
  bannedUsers: number;
  bannedOrgs: number;
  feedbacks: number;
  newFeedbacks: number;
  activeSubs: number;
  trialingSubs: number;
  pastDueSubs: number;
  customPlans: number;
  newUsers7d: number;
  newUsers30d: number;
  newOrgs7d: number;
  newOrgs30d: number;
  mrrCustomPlansBRL: number;
  planBreakdown: Array<{
    plan: string;
    status: string;
    _count: { _all: number };
  }>;
}

export const adminApi = {
  status: () => request<AdminStatus>('GET', '/admin/status'),
  unlock: (passphrase: string) =>
    request<{ ok: true; expiresAt: string }>('POST', '/admin/unlock', {
      passphrase,
    }),
  lock: () => request<{ ok: true }>('POST', '/admin/lock'),
  stats: () => request<AdminStats>('GET', '/admin/stats'),
  richStats: () => request<AdminRichStats>('GET', '/admin/stats/rich'),

  // Users
  listUsers: (params: { page: number; limit: number; search?: string }) => {
    const qs = new URLSearchParams({
      page: String(params.page),
      limit: String(params.limit),
      ...(params.search ? { search: params.search } : {}),
    });
    return request<Paginated<AdminUser>>('GET', `/admin/users?${qs}`);
  },
  getUserDetails: (id: string) =>
    request<AdminUserDetails>('GET', `/admin/users/${id}`),
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
  getOrgDetails: (id: string) =>
    request<AdminOrgDetails>('GET', `/admin/organizations/${id}`),

  // Audit logs
  listAuditLogs: (params: {
    page: number;
    limit: number;
    userId?: string;
    organizationId?: string;
    resource?: string;
    action?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    const qs = new URLSearchParams();
    qs.set('page', String(params.page));
    qs.set('limit', String(params.limit));
    if (params.userId) qs.set('userId', params.userId);
    if (params.organizationId) qs.set('organizationId', params.organizationId);
    if (params.resource) qs.set('resource', params.resource);
    if (params.action) qs.set('action', params.action);
    if (params.dateFrom) qs.set('dateFrom', params.dateFrom);
    if (params.dateTo) qs.set('dateTo', params.dateTo);
    return request<Paginated<AdminAuditLog>>(
      'GET',
      `/admin/audit-logs?${qs}`,
    );
  },
  getAuditFilterOptions: (scope: { userId?: string; organizationId?: string }) => {
    const qs = new URLSearchParams();
    if (scope.userId) qs.set('userId', scope.userId);
    if (scope.organizationId) qs.set('organizationId', scope.organizationId);
    return request<AdminAuditFilterOptions>(
      'GET',
      `/admin/audit-logs/filter-options?${qs}`,
    );
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
