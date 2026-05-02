import Input from '@/components/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useActiveOrganization } from '@/hooks/useOrganizations';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { cn } from '@/lib/utils';
import { RESOURCE_LABELS } from '@/lib/permissions';
import { useQuery } from '@tanstack/react-query';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Lock,
  RefreshCw,
  Scroll,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

interface AuditLogItem {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  } | null;
}

interface AuditLogResponse {
  data: AuditLogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3333';

const ACTION_BADGES: Record<
  string,
  { label: string; className: string; verb: string }
> = {
  create: {
    label: 'criar',
    verb: 'criou',
    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  },
  update: {
    label: 'editar',
    verb: 'editou',
    className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  },
  delete: {
    label: 'excluir',
    verb: 'excluiu',
    className: 'bg-red-500/10 text-red-700 dark:text-red-400',
  },
  add: {
    label: 'adicionar',
    verb: 'adicionou',
    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  },
  remove: {
    label: 'remover',
    verb: 'removeu',
    className: 'bg-red-500/10 text-red-700 dark:text-red-400',
  },
  accept: {
    label: 'aceitar',
    verb: 'aceitou',
    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  },
  reject: {
    label: 'recusar',
    verb: 'recusou',
    className: 'bg-red-500/10 text-red-700 dark:text-red-400',
  },
  cancel: {
    label: 'cancelar',
    verb: 'cancelou',
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  },
  auto_create: {
    label: 'auto-criar',
    verb: 'auto-criou',
    className: 'bg-muted text-muted-foreground',
  },
  update_role: {
    label: 'alterar cargo',
    verb: 'alterou cargo de',
    className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  },
};

const RESOURCE_OPTIONS = [
  { value: '', label: 'Todos os recursos' },
  ...Object.entries(RESOURCE_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
];

const ACTION_OPTIONS = [
  { value: '', label: 'Todas as ações' },
  ...Object.entries(ACTION_BADGES).map(([value, { label }]) => ({
    value,
    label,
  })),
];

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** Tenta extrair um label humano (nome, slug, email) do metadata. */
function extractLabel(meta: Record<string, unknown> | null): string | null {
  if (!meta) return null;
  const candidates = ['_label', 'name', 'slug', 'email'];
  for (const k of candidates) {
    const v = meta[k];
    if (typeof v === 'string' && v) return v;
  }
  return null;
}

/** Cabeçalho de grupo: "Hoje" / "Ontem" / "5 de janeiro de 2026". */
function dateGroupLabel(date: Date) {
  if (isToday(date)) return 'Hoje';
  if (isYesterday(date)) return 'Ontem';
  return format(date, "d 'de' MMMM, yyyy", { locale: ptBR });
}

// ─── Página ─────────────────────────────────────────────────────────────────

export default function AuditLogSettingsPage() {
  const features = usePlanFeatures();
  const { data: org } = useActiveOrganization();

  const [page, setPage] = useState(1);
  const [resource, setResource] = useState('');
  const [action, setAction] = useState('');
  const [userId, setUserId] = useState('');
  const limit = 25;

  const userOptions = useMemo(
    () => [
      { value: '', label: 'Todos os membros' },
      ...(org?.members ?? []).map((m) => ({
        value: m.userId,
        label: m.user?.name ?? m.user?.email ?? 'Membro',
      })),
    ],
    [org?.members],
  );

  const {
    data: response,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery<AuditLogResponse>({
    queryKey: ['audit-logs', page, resource, action, userId],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(resource ? { resource } : {}),
        ...(action ? { action } : {}),
        ...(userId ? { userId } : {}),
      });
      const res = await fetch(`${API_URL}/audit-logs?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `Erro ${res.status}`);
      }
      return res.json();
    },
    enabled: features.canViewAuditLogs,
    retry: false,
  });

  if (!features.canViewAuditLogs) return <UpsellPanel />;

  const items = response?.data ?? [];
  const total = response?.total ?? 0;
  const totalPages = response?.totalPages ?? 1;
  const hasFilters = !!(resource || action || userId);

  const clearFilters = () => {
    setResource('');
    setAction('');
    setUserId('');
    setPage(1);
  };

  // Agrupa logs do dia por cabeçalho de data
  const grouped = useMemo(() => {
    const map = new Map<string, AuditLogItem[]>();
    for (const item of items) {
      const date = new Date(item.createdAt);
      const key = format(date, 'yyyy-MM-dd');
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(([key, logs]) => ({
      key,
      date: new Date(`${key}T12:00:00`),
      logs,
    }));
  }, [items]);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="rounded-xl border bg-linear-to-br from-primary/8 via-card to-card p-6 sm:p-7 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 size-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-2xl bg-primary/15 flex items-center justify-center">
              <Scroll className="size-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                Logs de auditoria
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5 max-w-md">
                Tudo o que rola na sua organização — quem fez, quando, e o que
                mudou.
              </p>
              <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground flex-wrap">
                <span className="inline-flex items-center gap-1.5">
                  <Scroll className="size-3.5" />
                  <strong className="text-foreground font-semibold">
                    {total}
                  </strong>{' '}
                  {total === 1 ? 'evento' : 'eventos'}
                  {hasFilters && ' (com filtros)'}
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={cn('size-4', isFetching && 'animate-spin')}
            />
            Atualizar
          </Button>
        </div>
      </section>

      {/* ── Filtros ─────────────────────────────────────────── */}
      <section className="rounded-xl border bg-card p-4">
        <header className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filtros</span>
          </div>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-muted-foreground"
              onClick={clearFilters}
            >
              <X className="size-3.5" />
              Limpar filtros
            </Button>
          )}
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            title="Recurso"
            register={{
              name: 'resource',
              onChange: async () => {},
              onBlur: async () => {},
              ref: () => {},
            }}
            select={{
              options: RESOURCE_OPTIONS,
              value: resource,
              onChange: (v) => {
                setResource(v);
                setPage(1);
              },
              notFilter: true,
            }}
          />
          <Input
            title="Ação"
            register={{
              name: 'action',
              onChange: async () => {},
              onBlur: async () => {},
              ref: () => {},
            }}
            select={{
              options: ACTION_OPTIONS,
              value: action,
              onChange: (v) => {
                setAction(v);
                setPage(1);
              },
              notFilter: true,
            }}
          />
          <Input
            title="Membro"
            register={{
              name: 'userId',
              onChange: async () => {},
              onBlur: async () => {},
              ref: () => {},
            }}
            select={{
              options: userOptions,
              value: userId,
              onChange: (v) => {
                setUserId(v);
                setPage(1);
              },
              notFilter: true,
            }}
          />
        </div>
      </section>

      {/* ── Lista ───────────────────────────────────────────── */}
      <section className="rounded-xl border bg-card overflow-hidden">
        {isLoading && (
          <div className="px-6 py-12 text-sm text-muted-foreground text-center">
            Carregando logs…
          </div>
        )}

        {error && (
          <div className="px-6 py-12 text-sm text-destructive text-center">
            Erro ao carregar logs. Verifique se você é o owner desta
            organização.
          </div>
        )}

        {response && items.length === 0 && (
          <div className="px-6 py-16 text-center">
            <div className="size-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <Scroll className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">
              {hasFilters
                ? 'Nenhum evento com esses filtros'
                : 'Nenhum evento registrado'}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              {hasFilters
                ? 'Tente afrouxar os filtros.'
                : 'Quando alguém fizer algo na organização, vai aparecer aqui.'}
            </p>
          </div>
        )}

        {response && items.length > 0 && (
          <ul>
            {grouped.map((group) => (
              <li key={group.key}>
                <div className="px-6 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30 border-y">
                  {dateGroupLabel(group.date)}
                </div>
                <ul className="divide-y divide-border">
                  {group.logs.map((item) => (
                    <LogRow key={item.id} item={item} />
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}

        {response && total > 0 && (
          <footer className="px-6 py-3 border-t flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs text-muted-foreground">
              Mostrando{' '}
              <strong className="text-foreground font-medium">
                {(page - 1) * limit + 1}
                {'–'}
                {Math.min(page * limit, total)}
              </strong>{' '}
              de{' '}
              <strong className="text-foreground font-medium">{total}</strong>{' '}
              {total === 1 ? 'evento' : 'eventos'}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-4" />
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground px-2">
                Pág. {response.page} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </footer>
        )}
      </section>
    </div>
  );
}

// ─── Upsell ─────────────────────────────────────────────────────────────────

function UpsellPanel() {
  return (
    <section className="rounded-xl border bg-card p-8 text-center">
      <div className="size-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <Lock className="size-6 text-primary" />
      </div>
      <h2 className="text-lg font-semibold">
        Logs de auditoria a partir do plano Pro
      </h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
        Compliance LGPD: veja tudo que rolou na sua organização — quando, de
        onde e o que mudou. Essencial pra qualquer profissional de saúde.
      </p>
      <Link to="/pricing">
        <Button className="mt-5">Fazer upgrade</Button>
      </Link>
    </section>
  );
}

// ─── Linha do log ───────────────────────────────────────────────────────────

function LogRow({ item }: { item: AuditLogItem }) {
  const [expanded, setExpanded] = useState(false);
  const action = ACTION_BADGES[item.action] ?? {
    label: item.action,
    verb: item.action,
    className: 'bg-muted text-muted-foreground',
  };
  const userName = item.user?.name ?? 'Usuário removido';
  const userEmail = item.user?.email ?? '';
  const resourceLabel = RESOURCE_LABELS[item.resource] ?? item.resource;
  const entityLabel = extractLabel(item.metadata);
  const date = new Date(item.createdAt);

  // O que mudou?
  const meta = (item.metadata ?? {}) as Record<string, unknown>;
  const alteracoes = meta.alteracoes as
    | Record<string, { antes: unknown; depois: unknown }>
    | undefined;
  const body = meta.body as Record<string, unknown> | undefined;
  const registroRemovido = meta.registroRemovido as
    | Record<string, unknown>
    | undefined;

  const hasDetails = !!(
    alteracoes ||
    body ||
    registroRemovido ||
    (item.metadata && Object.keys(item.metadata).length > 0)
  );

  return (
    <li className="px-6 py-4 hover:bg-muted/20 transition-colors">
      <div className="flex items-start gap-3">
        <Avatar className="size-9 mt-0.5">
          <AvatarImage src={item.user?.image ?? ''} alt={userName} />
          <AvatarFallback className="text-xs">
            {initials(userName) || '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{userName}</span>
            <span
              className={cn(
                'text-[11px] font-medium px-1.5 py-0.5 rounded-md',
                action.className,
              )}
            >
              {action.label}
            </span>
            <span className="text-sm text-muted-foreground">
              em{' '}
              <strong className="font-medium text-foreground">
                {resourceLabel}
              </strong>
            </span>
            {entityLabel && (
              <span className="text-xs text-muted-foreground">
                · {entityLabel}
              </span>
            )}
            <span
              className="text-xs text-muted-foreground ml-auto shrink-0"
              title={format(date, "d 'de' MMM, yyyy 'às' HH:mm:ss", {
                locale: ptBR,
              })}
            >
              {format(date, 'HH:mm', { locale: ptBR })}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-1 truncate">
            {userEmail}
            {item.ip && <> · {item.ip}</>}
          </div>

          {hasDetails && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-primary hover:underline mt-1.5 inline-flex items-center gap-1 cursor-pointer"
            >
              {expanded ? 'Ocultar detalhes' : 'Ver detalhes'}
              <ChevronDown
                className={cn(
                  'size-3 transition-transform',
                  expanded && 'rotate-180',
                )}
              />
            </button>
          )}

          {expanded && (
            <div className="mt-3 space-y-3">
              {alteracoes && Object.keys(alteracoes).length > 0 && (
                <DiffTable changes={alteracoes} />
              )}
              {!alteracoes && body && (
                <KeyValueTable title="Conteúdo" data={body} />
              )}
              {registroRemovido && (
                <KeyValueTable
                  title="Registro removido"
                  data={registroRemovido}
                />
              )}
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
                  Detalhes técnicos
                </summary>
                <pre className="mt-2 text-[11px] bg-muted/40 rounded-md p-2 overflow-x-auto max-h-48 text-muted-foreground">
                  {JSON.stringify(
                    {
                      resourceId: item.resourceId,
                      ip: item.ip,
                      userAgent: item.userAgent,
                      metadata: item.metadata,
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

// ─── Tabela de diff (antes / depois) ────────────────────────────────────────

function DiffTable({
  changes,
}: {
  changes: Record<string, { antes: unknown; depois: unknown }>;
}) {
  return (
    <div className="rounded-md border bg-muted/20 overflow-hidden">
      <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b">
        Mudanças
      </div>
      <table className="w-full text-xs">
        <tbody className="divide-y divide-border">
          {Object.entries(changes).map(([field, change]) => (
            <tr key={field}>
              <td className="px-3 py-2 font-medium text-foreground align-top w-32">
                {field}
              </td>
              <td className="px-3 py-2 align-top">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-500/10 text-red-700 dark:text-red-400">
                    antes
                  </span>
                  <ValuePreview value={change.antes} />
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                    depois
                  </span>
                  <ValuePreview value={change.depois} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KeyValueTable({
  title,
  data,
}: {
  title: string;
  data: Record<string, unknown>;
}) {
  const entries = Object.entries(data).filter(
    ([k]) => k !== '_label' && k !== 'path' && k !== 'method',
  );
  if (entries.length === 0) return null;
  return (
    <div className="rounded-md border bg-muted/20 overflow-hidden">
      <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b">
        {title}
      </div>
      <table className="w-full text-xs">
        <tbody className="divide-y divide-border">
          {entries.map(([k, v]) => (
            <tr key={k}>
              <td className="px-3 py-2 font-medium align-top w-32">{k}</td>
              <td className="px-3 py-2 align-top">
                <ValuePreview value={v} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ValuePreview({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">vazio</span>;
  }
  if (typeof value === 'string') {
    return (
      <span className="font-mono text-[11px] wrap-break-word">
        {value === '' ? (
          <span className="text-muted-foreground italic">vazio</span>
        ) : (
          value
        )}
      </span>
    );
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return <span className="font-mono text-[11px]">{String(value)}</span>;
  }
  return (
    <code className="font-mono text-[11px] text-muted-foreground wrap-break-word">
      {JSON.stringify(value)}
    </code>
  );
}
