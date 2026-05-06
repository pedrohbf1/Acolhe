import Input from '@/components/input';
import InputUser from '@/components/input-user';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import {
  adminApi,
  AdminLockedError,
  type AdminAuditLog,
  type AdminCustomPlan,
  type AdminFeedback,
  type AdminOrg,
  type AdminOrgDetails,
  type AdminUser,
  type AdminUserDetails,
} from '@/lib/admin-api';
import { cn } from '@/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertCircle,
  Ban,
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Crown,
  KeyRound,
  Loader2,
  LogOut,
  MailQuestion,
  Mail,
  MessageSquare,
  Plus,
  Receipt,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Unlock,
  UserPlus,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

type Tab = 'overview' | 'users' | 'orgs' | 'feedbacks' | 'plans';

// ─── Página principal ──────────────────────────────────────────────────────

export default function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: status, isLoading } = useQuery({
    queryKey: ['admin', 'status'],
    queryFn: () => adminApi.status(),
    retry: false,
  });

  // Quem não é super_admin nunca passa daqui — manda pra "/" sem deixar
  // pista que o painel existe.
  useEffect(() => {
    if (!isLoading && status && !status.isSuperAdmin) {
      navigate('/', { replace: true });
    }
  }, [isLoading, status, navigate]);

  if (isLoading || !status) {
    return <FullScreenLoader />;
  }

  if (!status.isSuperAdmin) {
    // será redirecionado pelo useEffect acima
    return null;
  }

  if (!status.unlocked) {
    return <UnlockScreen userName={user?.name ?? ''} />;
  }

  return <AdminPanel />;
}

// ─── Loader full-screen ────────────────────────────────────────────────────

function FullScreenLoader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

// ─── Tela de unlock ────────────────────────────────────────────────────────

function UnlockScreen({ userName }: { userName: string }) {
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  const unlock = useMutation({
    mutationFn: (p: string) => adminApi.unlock(p),
    onSuccess: () => {
      toast.success('Painel destrancado.');
      qc.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (passphrase.length < 8) {
      setError('Passphrase muito curta.');
      return;
    }
    unlock.mutate(passphrase);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border-2 border-primary/30 bg-card overflow-hidden shadow-2xl">
          <div className="bg-linear-to-br from-primary/10 via-card to-card px-6 sm:px-8 py-8 border-b">
            <div className="size-14 rounded-2xl bg-primary/15 flex items-center justify-center mb-4">
              <KeyRound className="size-7 text-primary" />
            </div>
            <h1 className="text-xl font-bold">Painel mestre</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Olá <strong className="text-foreground">{userName}</strong>. Digite a passphrase
              mestre pra destrancar o painel. A sessão dura 60 minutos.
            </p>
          </div>

          <form onSubmit={onSubmit} className="px-6 sm:px-8 py-6 flex flex-col gap-4">
            <Input
              title="Passphrase"
              type="password"
              register={{
                name: 'passphrase',
                onChange: async (e) => {
                  setPassphrase((e.target as HTMLInputElement).value);
                  setError(null);
                },
                onBlur: async () => {},
                ref: () => {},
              }}
              inputConfig={{
                value: passphrase,
                placeholder: '••••••••••••',
                autoFocus: true,
                disabled: unlock.isPending,
              }}
            />
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive flex items-start gap-2">
                <AlertCircle className="size-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <Button
              type="submit"
              className="w-full gap-2"
              disabled={unlock.isPending || !passphrase}
            >
              {unlock.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Unlock className="size-4" />
              )}
              {unlock.isPending ? 'Validando…' : 'Destrancar'}
            </Button>
            <p className="text-xs text-muted-foreground/80 leading-relaxed">
              Tentativas falhas são logadas. Em caso de comprometimento, alterne a passphrase pelo
              script <code>hash-admin-passphrase.ts</code> e atualize o <code>.env</code>.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Painel após unlock ────────────────────────────────────────────────────

function AdminPanel() {
  const [tab, setTab] = useState<Tab>('overview');
  const qc = useQueryClient();

  const lock = useMutation({
    mutationFn: () => adminApi.lock(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      toast.success('Painel trancado.');
    },
  });

  const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: 'overview', label: 'Visão geral', icon: ShieldCheck },
    { id: 'feedbacks', label: 'Feedbacks', icon: MessageSquare },
    { id: 'users', label: 'Usuários', icon: Users },
    { id: 'orgs', label: 'Organizações', icon: Building2 },
    { id: 'plans', label: 'Planos custom', icon: Receipt },
  ];

  // Tabs cuja UI faz seu próprio scroll interno (master/detail). Pra elas o
  // <main> precisa ser overflow-hidden — pra o flex-1 ter altura conhecida.
  // Pras outras (overview, plans) deixamos main rolar normalmente.
  const usesOwnScroll =
    tab === 'users' || tab === 'orgs' || tab === 'feedbacks';

  return (
    <div className="fixed inset-0 flex flex-col bg-muted/20 overflow-hidden">
      {/* Top bar */}
      <header className="shrink-0 bg-card border-b">
        <div className="w-full px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <ShieldAlert className="size-4 text-primary" />
            </div>
            <div>
              <div className="text-sm font-semibold">Painel mestre</div>
              <div className="text-[11px] text-muted-foreground">
                Acesso super_admin · sessão 60 min
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => lock.mutate()}
            disabled={lock.isPending}
          >
            <LogOut className="size-3.5" />
            Trancar painel
          </Button>
        </div>
        <nav className="w-full px-4 sm:px-6 flex items-center gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer',
                  active
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-4" />
                {t.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main
        className={cn(
          'flex-1 min-h-0 w-full px-4 sm:px-6 py-6',
          usesOwnScroll ? 'overflow-hidden flex flex-col' : 'overflow-y-auto',
        )}
      >
        {tab === 'overview' && <OverviewTab onNav={setTab} />}
        {tab === 'feedbacks' && <FeedbacksTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'orgs' && <OrgsTab />}
        {tab === 'plans' && <PlansTab />}
      </main>
    </div>
  );
}

// ─── Overview ──────────────────────────────────────────────────────────────

function OverviewTab({ onNav }: { onNav: (t: Tab) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'stats', 'rich'],
    queryFn: () => adminApi.richStats(),
  });

  if (isLoading || !data) return <Loader2 className="size-5 animate-spin" />;

  const verifiedPct = data.users > 0 ? Math.round((data.verifiedUsers / data.users) * 100) : 0;
  const paidSubs = data.activeSubs + data.trialingSubs;

  // Agrega breakdown de planos por nome (somando active + trialing).
  const planCounts = data.planBreakdown.reduce<Record<string, number>>((acc, item) => {
    if (item.status === 'active' || item.status === 'trialing') {
      acc[item.plan] = (acc[item.plan] ?? 0) + item._count._all;
    }
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      {/* Linha 1: KPIs principais */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatBox
          icon={<Users className="size-5 text-primary" />}
          label="Usuários totais"
          value={data.users}
          sub={`+${data.newUsers7d} nos últimos 7 dias`}
          onClick={() => onNav('users')}
        />
        <StatBox
          icon={<Building2 className="size-5 text-primary" />}
          label="Organizações"
          value={data.orgs}
          sub={`+${data.newOrgs7d} nos últimos 7 dias`}
          onClick={() => onNav('orgs')}
        />
        <StatBox
          icon={<CreditCard className="size-5 text-primary" />}
          label="Assinaturas ativas"
          value={paidSubs}
          sub={
            data.trialingSubs > 0
              ? `${data.trialingSubs} em trial · ${data.activeSubs} pagando`
              : `${data.activeSubs} pagando`
          }
        />
        <StatBox
          icon={<TrendingUp className="size-5 text-primary" />}
          label="MRR planos custom"
          value={data.mrrCustomPlansBRL}
          format={(v) =>
            v.toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
              maximumFractionDigits: 0,
            })
          }
          sub={`${data.customPlans} ${data.customPlans === 1 ? 'plano' : 'planos'} custom`}
          onClick={() => onNav('plans')}
        />
      </div>

      {/* Linha 2: alertas + breakdown de planos */}
      <div className="grid gap-3 lg:grid-cols-3">
        <button
          type="button"
          onClick={() => onNav('feedbacks')}
          className={cn(
            'text-left rounded-xl border bg-card p-5 transition-all cursor-pointer hover:border-primary/40 hover:shadow-sm',
            data.newFeedbacks > 0 && 'ring-2 ring-amber-500/20 border-amber-500/40',
          )}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <MessageSquare className="size-5 text-primary" />
            </div>
            {data.newFeedbacks > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-white tracking-wide">
                AÇÃO
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground uppercase tracking-wide">
            Feedbacks novos
          </div>
          <div className="text-2xl font-bold mt-1">{data.newFeedbacks}</div>
          <div className="text-xs text-muted-foreground mt-1">{data.feedbacks} no total</div>
        </button>

        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <BadgeCheck className="size-5 text-primary" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                E-mails verificados
              </div>
              <div className="text-base font-semibold">{verifiedPct}% dos usuários</div>
            </div>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-emerald-500" style={{ width: `${verifiedPct}%` }} />
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            {data.verifiedUsers} de {data.users}
            {data.bannedUsers > 0 && ` · ${data.bannedUsers} banidos`}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Crown className="size-5 text-primary" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                Distribuição de planos
              </div>
              <div className="text-base font-semibold">{paidSubs + data.customPlans} pagantes</div>
            </div>
          </div>
          <ul className="text-xs space-y-1.5">
            {(['pro', 'team'] as const).map((p) => (
              <li key={p} className="flex items-center justify-between">
                <span className="capitalize text-muted-foreground">{p}</span>
                <span className="font-semibold">{planCounts[p] ?? 0}</span>
              </li>
            ))}
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground inline-flex items-center gap-1">
                <Sparkles className="size-3" />
                custom
              </span>
              <span className="font-semibold">{data.customPlans}</span>
            </li>
            {data.pastDueSubs > 0 && (
              <li className="flex items-center justify-between text-destructive">
                <span>past_due</span>
                <span className="font-semibold">{data.pastDueSubs}</span>
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* Linha 3: crescimento (30d) */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                Novos usuários (30d)
              </div>
              <div className="text-2xl font-bold mt-1">+{data.newUsers30d}</div>
            </div>
            <Users className="size-8 text-muted-foreground/30" />
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            {data.newUsers7d} nos últimos 7 dias ·{' '}
            <span
              className={cn(
                data.newUsers7d * 4 > data.newUsers30d
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-muted-foreground',
              )}
            >
              {data.newUsers7d * 4 > data.newUsers30d ? 'acelerando' : 'estável'}
            </span>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                Novas organizações (30d)
              </div>
              <div className="text-2xl font-bold mt-1">+{data.newOrgs30d}</div>
            </div>
            <Building2 className="size-8 text-muted-foreground/30" />
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            {data.newOrgs7d} nos últimos 7 dias
            {data.bannedOrgs > 0 && ` · ${data.bannedOrgs} banidas`}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({
  icon,
  label,
  value,
  sub,
  onClick,
  urgent,
  format,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub?: string;
  onClick?: () => void;
  urgent?: boolean;
  format?: (v: number) => string;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'text-left rounded-xl border bg-card p-5 transition-all',
        onClick && 'cursor-pointer hover:border-primary/40 hover:shadow-sm',
        urgent && 'ring-2 ring-amber-500/20 border-amber-500/40',
      )}
    >
      <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
        {icon}
      </div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold mt-1">{format ? format(value) : value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </Tag>
  );
}

// ─── Feedbacks ─────────────────────────────────────────────────────────────

const FEEDBACK_STATUS_LABELS: Record<string, string> = {
  new: 'Novo',
  read: 'Lido',
  replied: 'Respondido',
  archived: 'Arquivado',
};
const FEEDBACK_TYPES: Record<string, { label: string; className: string }> = {
  bug: { label: 'Bug', className: 'bg-destructive/15 text-destructive' },
  suggestion: {
    label: 'Sugestão',
    className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  },
  praise: {
    label: 'Elogio',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  },
  question: {
    label: 'Pergunta',
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  },
};
const FEEDBACK_TYPE_OPTIONS = [
  { value: '', label: 'Todos os tipos' },
  ...Object.entries(FEEDBACK_TYPES).map(([value, { label }]) => ({ value, label })),
];

const FEEDBACK_STATUS_PILLS = [
  { value: '', label: 'Todos' },
  { value: 'new', label: 'Novos' },
  { value: 'read', label: 'Lidos' },
  { value: 'replied', label: 'Respondidos' },
  { value: 'archived', label: 'Arquivados' },
];

const STATUS_OPTIONS = Object.entries(FEEDBACK_STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
}));

function FeedbacksTab() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [crossUserId, setCrossUserId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'feedbacks', page, statusFilter, typeFilter],
    queryFn: () =>
      adminApi.listFeedbacks({
        page,
        limit: 25,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
      }),
  });

  // Auto-seleciona primeiro item
  useEffect(() => {
    if (!selectedId && data?.data[0]) {
      setSelectedId(data.data[0].id);
    }
  }, [data, selectedId]);

  const updateFeedback = useMutation({
    mutationFn: (input: { id: string; status?: string; adminNote?: string }) =>
      adminApi.updateFeedback(input.id, {
        status: input.status ?? selected?.status ?? 'new',
        adminNote: input.adminNote,
      }),
    onSuccess: () => {
      toast.success('Feedback atualizado.');
      qc.invalidateQueries({ queryKey: ['admin', 'feedbacks'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selected =
    data?.data.find((f) => f.id === selectedId) ?? data?.data[0] ?? null;

  // Marca como "lido" automaticamente ao abrir um feedback novo
  useEffect(() => {
    if (selected && selected.status === 'new') {
      updateFeedback.mutate({ id: selected.id, status: 'read' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  // Stats — overview rápido pra entender prioridade
  const counts = useMemo(() => {
    const acc: Record<string, number> = {
      total: data?.total ?? 0,
      new: 0,
      bug: 0,
      suggestion: 0,
    };
    data?.data.forEach((f) => {
      if (f.status === 'new') acc.new++;
      acc[f.type] = (acc[f.type] ?? 0) + 1;
    });
    return acc;
  }, [data]);

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      <div className="flex items-start justify-between gap-3 flex-wrap shrink-0">
        <div>
          <h2 className="text-base font-semibold">Feedbacks</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Bugs, sugestões e elogios enviados pelos usuários — selecione pra ver
            contexto completo e adicionar nota interna.
          </p>
        </div>
        {data && (
          <div className="flex items-center gap-2 text-xs">
            {counts.new > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400 font-medium">
                {counts.new} novo{counts.new > 1 ? 's' : ''}
              </span>
            )}
            <span className="text-muted-foreground">{counts.total} total</span>
          </div>
        )}
      </div>

      {/* Filtros — pills de status + select de tipo */}
      <div className="flex items-center justify-between gap-3 flex-wrap shrink-0">
        <div className="inline-flex rounded-md border border-border overflow-hidden">
          {FEEDBACK_STATUS_PILLS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => {
                setStatusFilter(p.value);
                setPage(1);
              }}
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer border-r last:border-r-0',
                statusFilter === p.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card hover:bg-muted/50',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="w-48">
          <Input
            title=""
            className={{ classNameLabel: 'hidden' }}
            register={{
              name: 'type',
              onChange: async () => {},
              onBlur: async () => {},
              ref: () => {},
            }}
            select={{
              options: FEEDBACK_TYPE_OPTIONS,
              value: typeFilter,
              onChange: (v) => {
                setTypeFilter(v);
                setPage(1);
              },
              notFilter: true,
            }}
          />
        </div>
      </div>

      {/* Master/detail */}
      <div className="grid lg:grid-cols-[minmax(360px,460px)_1fr] gap-4 flex-1 min-h-0">
        {/* Lista esquerda */}
        <div className="rounded-xl border bg-card overflow-hidden flex flex-col min-h-0">
          {isLoading && (
            <div className="px-6 py-8 text-sm text-muted-foreground text-center">
              Carregando…
            </div>
          )}
          {data && data.data.length === 0 && (
            <div className="px-6 py-12 text-sm text-center">
              <MailQuestion className="size-8 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium">Sem feedbacks</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ajuste o filtro ou aguarde — quando alguém enviar pela /feedback,
                aparece aqui.
              </p>
            </div>
          )}
          {data && data.data.length > 0 && (
            <ul className="divide-y divide-border overflow-y-auto flex-1">
              {data.data.map((f) => (
                <FeedbackListRow
                  key={f.id}
                  feedback={f}
                  selected={selectedId === f.id}
                  onSelect={() => setSelectedId(f.id)}
                />
              ))}
            </ul>
          )}
          {data && data.totalPages > 1 && (
            <div className="px-3 py-2 border-t flex items-center justify-between text-[11px] shrink-0">
              <span className="text-muted-foreground">
                {data.page}/{data.totalPages} · {data.total}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ←
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  →
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Detalhe direita */}
        <div className="rounded-xl border bg-card overflow-hidden min-h-0 flex flex-col">
          {selected ? (
            <FeedbackDetailPanel
              feedback={selected}
              onOpenUser={() => setCrossUserId(selected.user.id)}
              onChangeStatus={(s) =>
                updateFeedback.mutate({ id: selected.id, status: s })
              }
              onSaveNote={(note) =>
                updateFeedback.mutate({
                  id: selected.id,
                  status: selected.status,
                  adminNote: note,
                })
              }
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Selecione um feedback.
            </div>
          )}
        </div>
      </div>

      {crossUserId && (
        <UserDetailDialog
          userId={crossUserId}
          onClose={() => setCrossUserId(null)}
          onOpenOrg={(oid) => {
            setCrossUserId(null);
            window.dispatchEvent(
              new CustomEvent('admin:open-org', { detail: { orgId: oid } }),
            );
          }}
        />
      )}
    </div>
  );
}

function FeedbackListRow({
  feedback,
  selected,
  onSelect,
}: {
  feedback: AdminFeedback;
  selected: boolean;
  onSelect: () => void;
}) {
  const isNew = feedback.status === 'new';
  const typeStyle =
    FEEDBACK_TYPES[feedback.type] ?? {
      label: feedback.type,
      className: 'bg-muted text-muted-foreground',
    };

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'w-full px-4 py-3 flex flex-col gap-1.5 text-left transition-colors cursor-pointer',
          selected
            ? 'bg-primary/10'
            : isNew
            ? 'bg-amber-500/5 hover:bg-amber-500/10'
            : 'hover:bg-muted/40',
        )}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              'text-[10px] font-semibold px-1.5 py-0.5 rounded',
              typeStyle.className,
            )}
          >
            {typeStyle.label}
          </span>
          {isNew && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-white tracking-wide">
              NOVO
            </span>
          )}
          <span className="text-[10px] text-muted-foreground ml-auto">
            {format(new Date(feedback.createdAt), 'd MMM, HH:mm', { locale: ptBR })}
          </span>
        </div>
        <div className="text-sm font-semibold truncate">{feedback.subject}</div>
        <div className="flex items-center gap-2">
          <Avatar className="size-5">
            <AvatarImage
              src={feedback.user?.image ?? ''}
              alt={feedback.user?.name ?? ''}
            />
            <AvatarFallback className="text-[8px]">
              {initials(feedback.user?.name ?? '?')}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground truncate flex-1">
            {feedback.user?.name}
          </span>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed whitespace-pre-wrap">
          {feedback.message}
        </p>
      </button>
    </li>
  );
}

function FeedbackDetailPanel({
  feedback,
  onOpenUser,
  onChangeStatus,
  onSaveNote,
}: {
  feedback: AdminFeedback;
  onOpenUser: () => void;
  onChangeStatus: (status: string) => void;
  onSaveNote: (note: string) => void;
}) {
  const typeStyle =
    FEEDBACK_TYPES[feedback.type] ?? {
      label: feedback.type,
      className: 'bg-muted text-muted-foreground',
    };
  const [note, setNote] = useState(feedback.adminNote ?? '');

  // Reset nota quando o feedback muda
  useEffect(() => {
    setNote(feedback.adminNote ?? '');
  }, [feedback.id, feedback.adminNote]);

  const noteDirty = note.trim() !== (feedback.adminNote ?? '').trim();

  // User context — feedbacks anteriores e plano deste usuário
  const { data: userDetails } = useQuery({
    queryKey: ['admin', 'user-details', feedback.user.id],
    queryFn: () => adminApi.getUserDetails(feedback.user.id),
    enabled: !!feedback.user.id,
  });

  const otherFeedbacks =
    userDetails?.recentFeedbacks.filter((f) => f.id !== feedback.id) ?? [];

  return (
    <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-5">
      {/* Header com remetente e meta */}
      <div className="flex items-start gap-3 rounded-xl border bg-muted/20 p-4">
        <Avatar className="size-12">
          <AvatarImage
            src={feedback.user?.image ?? ''}
            alt={feedback.user?.name ?? ''}
          />
          <AvatarFallback>{initials(feedback.user?.name ?? '?')}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onOpenUser}
              className="text-sm font-semibold hover:text-primary hover:underline truncate cursor-pointer"
            >
              {feedback.user?.name}
            </button>
            {userDetails?.banned && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground tracking-wide">
                BANIDO
              </span>
            )}
            {userDetails?.customPlan && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 inline-flex items-center gap-1">
                <Sparkles className="size-3" />
                {userDetails.customPlan.name}
              </span>
            )}
          </div>
          <a
            href={`mailto:${feedback.user?.email}?subject=Re: ${feedback.subject}`}
            className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-0.5"
          >
            <Mail className="size-3" />
            {feedback.user?.email}
          </a>
          <div className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-3 flex-wrap">
            <span>
              Enviado{' '}
              {format(new Date(feedback.createdAt), "d 'de' MMM 'de' yyyy, HH:mm", {
                locale: ptBR,
              })}
            </span>
            {userDetails && (
              <span>
                {userDetails._count.feedbacks}{' '}
                {userDetails._count.feedbacks === 1 ? 'feedback' : 'feedbacks'} no total
              </span>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenUser}
          className="shrink-0 gap-1.5"
        >
          Ver perfil
          <ChevronRight className="size-3.5" />
        </Button>
      </div>

      {/* Tipo, status, assunto */}
      <div>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span
            className={cn(
              'text-[11px] font-semibold px-2 py-0.5 rounded uppercase tracking-wide',
              typeStyle.className,
            )}
          >
            {typeStyle.label}
          </span>
          <div className="ml-auto w-44">
            <Input
              title=""
              className={{ classNameLabel: 'hidden' }}
              register={{
                name: 'status',
                onChange: async () => {},
                onBlur: async () => {},
                ref: () => {},
              }}
              select={{
                options: STATUS_OPTIONS,
                value: feedback.status,
                onChange: onChangeStatus,
                notFilter: true,
              }}
            />
          </div>
        </div>
        <h2 className="text-xl font-bold tracking-tight">{feedback.subject}</h2>
      </div>

      {/* Mensagem */}
      <div className="rounded-xl border bg-muted/20 p-4">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {feedback.message}
        </p>
      </div>

      {/* Nota interna do super_admin */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">
          Nota interna (não visível ao usuário)
        </label>
        <Input
          title=""
          type="textarea"
          className={{ classNameLabel: 'hidden' }}
          register={{
            name: `note-${feedback.id}`,
            onChange: async (e) => setNote((e.target as HTMLTextAreaElement).value),
            onBlur: async () => {},
            ref: () => {},
          }}
          inputConfig={{
            value: note,
            placeholder:
              'Anote contexto, decisão tomada, ticket relacionado, próximo passo…',
            rows: 4,
            maxLength: 2000,
          }}
        />
        {noteDirty && (
          <div className="flex justify-end gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNote(feedback.adminNote ?? '')}
            >
              Cancelar
            </Button>
            <Button size="sm" onClick={() => onSaveNote(note)}>
              Salvar nota
            </Button>
          </div>
        )}
      </div>

      {/* Outros feedbacks deste usuário */}
      {otherFeedbacks.length > 0 && (
        <Section
          title={`Outros feedbacks deste usuário (${otherFeedbacks.length})`}
          icon={<MessageSquare className="size-4 text-muted-foreground" />}
        >
          <ul className="rounded-xl border divide-y divide-border max-h-60 overflow-auto">
            {otherFeedbacks.map((f) => (
              <li key={f.id} className="px-3 py-2 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={cn(
                      'text-[10px] font-semibold px-1.5 py-0.5 rounded',
                      FEEDBACK_TYPES[f.type]?.className ??
                        'bg-muted text-muted-foreground',
                    )}
                  >
                    {FEEDBACK_TYPES[f.type]?.label ?? f.type}
                  </span>
                  <span className="font-medium truncate flex-1">{f.subject}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(f.createdAt), 'd MMM', { locale: ptBR })}
                  </span>
                </div>
                <p className="text-muted-foreground line-clamp-2 mt-0.5 whitespace-pre-wrap">
                  {f.message}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

// ─── Users ─────────────────────────────────────────────────────────────────

function UsersTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [banTarget, setBanTarget] = useState<AdminUser | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', page, search],
    queryFn: () =>
      adminApi.listUsers({
        page,
        limit: 25,
        search: search || undefined,
      }),
  });

  // Auto-seleciona o primeiro usuário ao trocar de página/busca
  useEffect(() => {
    if (!selectedUserId && data?.data[0]) {
      setSelectedUserId(data.data[0].id);
    }
  }, [data, selectedUserId]);

  const unban = useMutation({
    mutationFn: (id: string) => adminApi.unbanUser(id),
    onSuccess: () => {
      toast.success('Usuário desbanido.');
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      qc.invalidateQueries({ queryKey: ['admin', 'user-details'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      <div className="flex items-center justify-between gap-3 flex-wrap shrink-0">
        <div>
          <h2 className="text-base font-semibold">Usuários</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Selecione um usuário pra ver organizações, plano, atividade e dados de contato — útil
            pra suporte, descontos e churn.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none z-10" />
          <Input
            title=""
            className={{
              classNameLabel: 'hidden',
              classNameInput: 'pl-9',
            }}
            register={{
              name: 'search',
              onChange: async (e) => {
                setSearch((e.target as HTMLInputElement).value);
                setPage(1);
              },
              onBlur: async () => {},
              ref: () => {},
            }}
            inputConfig={{
              value: search,
              placeholder: 'Buscar nome ou e-mail…',
            }}
          />
        </div>
      </div>

      {/* Master/Detail — lista esquerda + painel direita */}
      <div className="grid lg:grid-cols-[minmax(320px,420px)_1fr] gap-4 flex-1 min-h-0">
        {/* ── Coluna esquerda: lista ─────────────────────────────────────── */}
        <div className="rounded-xl border bg-card overflow-hidden flex flex-col min-h-0">
          {isLoading && (
            <div className="px-6 py-8 text-sm text-muted-foreground text-center">Carregando…</div>
          )}
          {data && (
            <ul className="divide-y divide-border overflow-y-auto flex-1">
              {data.data.map((u) => (
                <UserListRow
                  key={u.id}
                  user={u}
                  selected={selectedUserId === u.id}
                  onSelect={() => setSelectedUserId(u.id)}
                />
              ))}
            </ul>
          )}
          {data && data.totalPages > 1 && (
            <div className="px-4 py-2 border-t flex items-center justify-between text-xs shrink-0">
              <span className="text-muted-foreground">
                {data.page}/{data.totalPages} · {data.total}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ←
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  →
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── Coluna direita: detalhe ────────────────────────────────────── */}
        <div className="rounded-xl border bg-card overflow-hidden min-h-0 flex flex-col">
          {selectedUserId ? (
            <UserDetailPanel
              userId={selectedUserId}
              onOpenOrg={(orgId) => {
                window.dispatchEvent(new CustomEvent('admin:open-org', { detail: { orgId } }));
              }}
              onBan={(u) => setBanTarget(u)}
              onUnban={(u) => unban.mutate(u.id)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Selecione um usuário pra ver os detalhes.
            </div>
          )}
        </div>
      </div>

      {banTarget && <BanUserDialog user={banTarget} onClose={() => setBanTarget(null)} />}
    </div>
  );
}

// ─── Linha da lista (compacta) ─────────────────────────────────────────────

function UserListRow({
  user,
  selected,
  onSelect,
}: {
  user: AdminUser;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'w-full px-4 py-3 flex items-center gap-3 text-left transition-colors cursor-pointer',
          selected ? 'bg-primary/10' : 'hover:bg-muted/40',
        )}
      >
        <Avatar className="size-9">
          <AvatarImage src={user.image ?? ''} alt={user.name} />
          <AvatarFallback className="text-xs">{initials(user.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium flex items-center gap-1.5 flex-wrap">
            <span className="truncate">{user.name}</span>
            {user.role === 'super_admin' && (
              <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-primary text-primary-foreground tracking-wide">
                SUPER
              </span>
            )}
            {user.banned && (
              <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-destructive text-destructive-foreground tracking-wide">
                BAN
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground truncate">{user.email}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
            <span>
              {user._count.members} {user._count.members === 1 ? 'org' : 'orgs'}
            </span>
            {user.customPlan && (
              <span className="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-400">
                <Sparkles className="size-2.5" />
                {user.customPlan.name}
              </span>
            )}
          </div>
        </div>
        <ChevronRight
          className={cn(
            'size-4 shrink-0 transition-colors',
            selected ? 'text-primary' : 'text-muted-foreground',
          )}
        />
      </button>
    </li>
  );
}

// ─── Painel de detalhe (master/detail) ─────────────────────────────────────

function UserDetailPanel({
  userId,
  onOpenOrg,
  onBan,
  onUnban,
}: {
  userId: string;
  onOpenOrg: (orgId: string) => void;
  onBan: (user: AdminUser) => void;
  onUnban: (user: AdminUser) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'user-details', userId],
    queryFn: () => adminApi.getUserDetails(userId),
  });

  if (isLoading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="overflow-y-auto flex-1">
      <UserDetailContent
        data={data}
        onOpenOrg={onOpenOrg}
        onBan={() => onBan(data as unknown as AdminUser)}
        onUnban={() => onUnban(data as unknown as AdminUser)}
        inline
      />
    </div>
  );
}

function BanUserDialog({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [observation, setObservation] = useState('');
  const qc = useQueryClient();

  const ban = useMutation({
    mutationFn: () =>
      adminApi.banUser(user.id, {
        reason,
        observation: observation || undefined,
      }),
    onSuccess: () => {
      toast.success('Usuário banido.');
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Banir {user.name}?</DialogTitle>
          <DialogDescription>
            O usuário verá uma tela com motivo + observação ao acessar o app. Sessões ativas
            continuam funcionando até o logout.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Input
            title="Motivo (obrigatório)"
            register={{
              name: 'reason',
              onChange: async (e) => setReason((e.target as HTMLInputElement).value),
              onBlur: async () => {},
              ref: () => {},
            }}
            inputConfig={{
              value: reason,
              placeholder: 'Ex: Violação dos termos de uso',
              maxLength: 200,
            }}
          />
          <Input
            title="Observação (opcional, mais detalhes)"
            type="textarea"
            register={{
              name: 'observation',
              onChange: async (e) => setObservation((e.target as HTMLTextAreaElement).value),
              onBlur: async () => {},
              ref: () => {},
            }}
            inputConfig={{
              value: observation,
              placeholder:
                'Contexto extra que será mostrado pro usuário (ex: comportamento abusivo em XX/XX, ticket #123)',
              rows: 4,
              maxLength: 2000,
            }}
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={ban.isPending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => ban.mutate()}
            disabled={ban.isPending || reason.length < 3}
          >
            {ban.isPending ? 'Banindo…' : 'Banir usuário'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Orgs ──────────────────────────────────────────────────────────────────

function OrgsTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [banTarget, setBanTarget] = useState<AdminOrg | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [crossUserId, setCrossUserId] = useState<string | null>(null);
  const qc = useQueryClient();

  // Permite que outras abas (ex: detail de usuário) selecionem uma org aqui.
  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent<{ orgId: string }>).detail?.orgId;
      if (id) setSelectedOrgId(id);
    };
    window.addEventListener('admin:open-org', handler);
    return () => window.removeEventListener('admin:open-org', handler);
  }, []);

  const { data } = useQuery({
    queryKey: ['admin', 'orgs', page, search],
    queryFn: () =>
      adminApi.listOrgs({
        page,
        limit: 25,
        search: search || undefined,
      }),
  });

  // Auto-seleciona o primeiro item ao mudar lista
  useEffect(() => {
    if (!selectedOrgId && data?.data[0]) {
      setSelectedOrgId(data.data[0].id);
    }
  }, [data, selectedOrgId]);

  const unban = useMutation({
    mutationFn: (id: string) => adminApi.unbanOrg(id),
    onSuccess: () => {
      toast.success('Organização desbanida.');
      qc.invalidateQueries({ queryKey: ['admin', 'orgs'] });
      qc.invalidateQueries({ queryKey: ['admin', 'org-details'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      <div className="flex items-center justify-between gap-3 flex-wrap shrink-0">
        <div>
          <h2 className="text-base font-semibold">Organizações</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Selecione uma organização pra ver membros, owner, plano efetivo, convites
            e atividade — útil pra avaliar conta corporativa.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none z-10" />
          <Input
            title=""
            className={{
              classNameLabel: 'hidden',
              classNameInput: 'pl-9',
            }}
            register={{
              name: 'search',
              onChange: async (e) => {
                setSearch((e.target as HTMLInputElement).value);
                setPage(1);
              },
              onBlur: async () => {},
              ref: () => {},
            }}
            inputConfig={{ value: search, placeholder: 'Buscar nome ou slug…' }}
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(320px,420px)_1fr] gap-4 flex-1 min-h-0">
        {/* ── Lista esquerda ──────────────────────────────────────────── */}
        <div className="rounded-xl border bg-card overflow-hidden flex flex-col min-h-0">
          {data && (
            <ul className="divide-y divide-border overflow-y-auto flex-1">
              {data.data.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedOrgId(o.id)}
                    className={cn(
                      'w-full px-4 py-3 flex items-center gap-3 text-left transition-colors cursor-pointer',
                      selectedOrgId === o.id ? 'bg-primary/10' : 'hover:bg-muted/40',
                    )}
                  >
                    <div className="size-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Building2 className="size-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium flex items-center gap-1.5 flex-wrap">
                        <span className="truncate">{o.name}</span>
                        {o.banned && (
                          <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-destructive text-destructive-foreground tracking-wide">
                            BAN
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        /{o.slug}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>
                          {o._count.members}{' '}
                          {o._count.members === 1 ? 'membro' : 'membros'}
                        </span>
                        {o._count.invitations > 0 && (
                          <span>{o._count.invitations} convites</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight
                      className={cn(
                        'size-4 shrink-0 transition-colors',
                        selectedOrgId === o.id
                          ? 'text-primary'
                          : 'text-muted-foreground',
                      )}
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Detalhe direita ─────────────────────────────────────────── */}
        <div className="rounded-xl border bg-card overflow-hidden min-h-0 flex flex-col">
          {selectedOrgId ? (
            <OrgDetailPanel
              orgId={selectedOrgId}
              onOpenUser={(uid) => setCrossUserId(uid)}
              onBan={(o) => setBanTarget(o)}
              onUnban={(o) => unban.mutate(o.id)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Selecione uma organização pra ver os detalhes.
            </div>
          )}
        </div>
      </div>

      {banTarget && <BanOrgDialog org={banTarget} onClose={() => setBanTarget(null)} />}

      {crossUserId && (
        <UserDetailDialog
          userId={crossUserId}
          onClose={() => setCrossUserId(null)}
          onOpenOrg={(oid: string) => {
            setCrossUserId(null);
            setSelectedOrgId(oid);
          }}
        />
      )}
    </div>
  );
}

function BanOrgDialog({ org, onClose }: { org: AdminOrg; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [observation, setObservation] = useState('');
  const qc = useQueryClient();

  const ban = useMutation({
    mutationFn: () =>
      adminApi.banOrg(org.id, {
        reason,
        observation: observation || undefined,
      }),
    onSuccess: () => {
      toast.success('Organização banida.');
      qc.invalidateQueries({ queryKey: ['admin', 'orgs'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Banir organização "{org.name}"?</DialogTitle>
          <DialogDescription>
            Membros perdem acesso. Motivo e observação são exibidos a quem tentar acessar.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Input
            title="Motivo"
            register={{
              name: 'reason',
              onChange: async (e) => setReason((e.target as HTMLInputElement).value),
              onBlur: async () => {},
              ref: () => {},
            }}
            inputConfig={{
              value: reason,
              placeholder: 'Ex: Suspeita de fraude',
              maxLength: 200,
            }}
          />
          <Input
            title="Observação"
            type="textarea"
            register={{
              name: 'observation',
              onChange: async (e) => setObservation((e.target as HTMLTextAreaElement).value),
              onBlur: async () => {},
              ref: () => {},
            }}
            inputConfig={{
              value: observation,
              placeholder: 'Contexto extra…',
              rows: 4,
              maxLength: 2000,
            }}
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => ban.mutate()}
            disabled={ban.isPending || reason.length < 3}
          >
            {ban.isPending ? 'Banindo…' : 'Banir org'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Custom Plans (1:1 com user, integrado com Stripe) ────────────────────

const STRIPE_STATUS_STYLES: Record<string, { label: string; className: string }> = {
  active: {
    label: 'Ativa',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  },
  trialing: {
    label: 'Trial',
    className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  },
  incomplete: {
    label: 'Aguarda pagamento',
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  },
  incomplete_expired: {
    label: 'Pagto expirou',
    className: 'bg-destructive/15 text-destructive',
  },
  past_due: {
    label: 'Em atraso',
    className: 'bg-destructive/15 text-destructive',
  },
  canceled: {
    label: 'Cancelada',
    className: 'bg-muted text-muted-foreground',
  },
  unpaid: {
    label: 'Não pago',
    className: 'bg-destructive/15 text-destructive',
  },
};

function PlansTab() {
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminCustomPlan | null>(null);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['admin', 'custom-plans'],
    queryFn: () => adminApi.listCustomPlans(),
  });

  const remove = useMutation({
    mutationFn: (id: string) => adminApi.deleteCustomPlan(id),
    onSuccess: () => {
      toast.success('Plano excluído. Sub Stripe cancelada.');
      qc.invalidateQueries({ queryKey: ['admin', 'custom-plans'] });
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold">Planos customizados</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Limites e preço para um cliente específico (1:1). Cria Product + Price + Subscription na
            Stripe automaticamente — cobrança rola pelo cartão padrão do usuário.
          </p>
        </div>
        <Button className="gap-2" onClick={() => setCreating(true)}>
          <Plus className="size-4" /> Novo plano
        </Button>
      </div>

      {data && data.length === 0 && (
        <div className="rounded-xl border bg-card px-6 py-12 text-center">
          <Sparkles className="size-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">Sem planos customizados</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            Crie um plano sob medida pra um cliente — Stripe cobra automaticamente.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((p) => (
          <CustomPlanCard key={p.id} plan={p} onDelete={() => setDeleteTarget(p)} />
        ))}
      </div>

      {creating && <CreatePlanDialog onClose={() => setCreating(false)} />}

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir plano "{deleteTarget?.name}"?</DialogTitle>
            <DialogDescription>
              A subscription Stripe será cancelada (sem reembolso automático) e o plano será
              removido de <strong>{deleteTarget?.user.name}</strong>. O usuário cai pra Free a
              partir desse momento.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={remove.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && remove.mutate(deleteTarget.id)}
              disabled={remove.isPending}
            >
              {remove.isPending ? 'Excluindo…' : 'Excluir plano + sub Stripe'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CustomPlanCard({ plan, onDelete }: { plan: AdminCustomPlan; onDelete: () => void }) {
  const status = plan.stripeStatus
    ? (STRIPE_STATUS_STYLES[plan.stripeStatus] ?? {
        label: plan.stripeStatus,
        className: 'bg-muted text-muted-foreground',
      })
    : null;

  return (
    <div className="rounded-xl border bg-card p-4 flex flex-col">
      <div className="flex items-start gap-2">
        <div className="size-9 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
          <Sparkles className="size-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">{plan.name}</div>
          {plan.notes && (
            <div className="text-xs text-muted-foreground line-clamp-2">{plan.notes}</div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive shrink-0 -mt-1 -mr-1"
          onClick={onDelete}
          title="Excluir plano (cancela sub Stripe)"
        >
          <Ban className="size-4" />
        </Button>
      </div>

      {/* User atribuído */}
      <div className="mt-3 flex items-center gap-2 rounded-lg border bg-muted/30 p-2">
        <Avatar className="size-7">
          <AvatarImage src={plan.user.image ?? ''} alt={plan.user.name} />
          <AvatarFallback className="text-[10px]">{initials(plan.user.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="text-xs font-medium truncate">{plan.user.name}</div>
          <div className="text-[10px] text-muted-foreground truncate">{plan.user.email}</div>
        </div>
      </div>

      {/* Preço + status */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-bold">
            R$ {plan.monthlyPriceBRL.toFixed(2).replace('.', ',')}
          </span>
          <span className="text-xs text-muted-foreground">/mês</span>
        </div>
        {status && (
          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded', status.className)}>
            {status.label}
          </span>
        )}
      </div>

      <ul className="text-xs text-muted-foreground mt-3 space-y-0.5">
        <li>{plan.maxOrganizations} organizações</li>
        <li>{plan.maxPatients.toLocaleString('pt-BR')} pacientes</li>
        <li>{plan.maxMembers} membros</li>
        {plan.auditLog && <li>· Audit log</li>}
        {plan.customRoles && <li>· Cargos customizados</li>}
      </ul>

      <div className="mt-3 pt-3 border-t text-[10px] text-muted-foreground/80 font-mono break-all">
        sub: {plan.stripeSubscriptionId ?? '—'}
      </div>
    </div>
  );
}

function CreatePlanDialog({ onClose }: { onClose: () => void }) {
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [monthlyPrice, setMonthlyPrice] = useState('');
  const [yearlyPrice, setYearlyPrice] = useState('');
  const [maxOrgs, setMaxOrgs] = useState('5');
  const [maxPatients, setMaxPatients] = useState('1000');
  const [maxMembers, setMaxMembers] = useState('5');
  const [auditLog, setAuditLog] = useState(true);
  const [customRoles, setCustomRoles] = useState(true);
  const qc = useQueryClient();

  // Quando seleciona o user, sugere o nome do plano se ainda vazio
  const handlePickUser = (u: AdminUser) => {
    setSelectedUser(u);
    if (!name) setName(`Personalizado — ${u.name.split(' ')[0]}`);
  };

  // "1.234,56" → 1234.56 ; "" → 0
  const parseBRL = (formatted: string): number => {
    if (!formatted) return 0;
    const normalized = formatted.replace(/\./g, '').replace(',', '.');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  };

  const create = useMutation({
    mutationFn: () => {
      if (!selectedUser) throw new Error('Selecione um usuário');
      const monthly = parseBRL(monthlyPrice);
      if (!monthly || monthly <= 0) throw new Error('Preço mensal inválido');
      const yearly = yearlyPrice ? parseBRL(yearlyPrice) : undefined;
      return adminApi.createCustomPlan({
        userId: selectedUser.id,
        name,
        notes: notes || undefined,
        monthlyPriceBRL: monthly,
        yearlyPriceBRL: yearly,
        maxOrganizations: Number(maxOrgs),
        maxPatients: Number(maxPatients),
        maxMembers: Number(maxMembers),
        auditLog,
        customRoles,
      });
    },
    onSuccess: () => {
      toast.success('Plano criado e Stripe sub aberta!');
      qc.invalidateQueries({ queryKey: ['admin', 'custom-plans'] });
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const priceField = (
    title: string,
    value: string,
    setter: (v: string) => void,
    placeholder?: string,
  ) => (
    <Input
      title={title}
      mask="price"
      register={{
        name: title,
        onChange: async (e) => setter((e.target as HTMLInputElement).value),
        onBlur: async () => {},
        ref: () => {},
      }}
      inputConfig={{
        value,
        placeholder,
        inputMode: 'decimal',
      }}
    />
  );

  const intField = (
    title: string,
    value: string,
    setter: (v: string) => void,
    placeholder?: string,
  ) => (
    <Input
      title={title}
      mask="numero"
      register={{
        name: title,
        onChange: async (e) => setter((e.target as HTMLInputElement).value),
        onBlur: async () => {},
        ref: () => {},
      }}
      inputConfig={{
        value,
        placeholder,
        inputMode: 'numeric',
      }}
    />
  );

  const canSubmit =
    !!selectedUser && !!name && !!monthlyPrice && !!maxOrgs && !!maxPatients && !!maxMembers;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo plano customizado</DialogTitle>
          <DialogDescription>
            Plano 1:1 com um cliente. Stripe cria Product + Price + Subscription automaticamente.
            Cobrança rola via cartão default do usuário (se não tiver, status fica{' '}
            <em>incomplete</em> até ele configurar).
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="max-h-[65dvh]">
          <InputUser
            value={selectedUser}
            onChange={handlePickUser}
            onClear={() => setSelectedUser(null)}
            filterCustomPlan
            label="Usuário (1:1)"
            required
            placeholder="Pressione F1 ou digite para buscar"
          />
          {selectedUser?.customPlan && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="size-3.5 shrink-0" />
              Esse usuário já possui um plano custom. Exclua o atual antes de criar outro.
            </div>
          )}

          <Input
            title="Nome do plano"
            register={{
              name: 'name',
              onChange: async (e) => setName((e.target as HTMLInputElement).value),
              onBlur: async () => {},
              ref: () => {},
            }}
            inputConfig={{
              value: name,
              placeholder: 'ex: Enterprise — Clínica Acme',
              maxLength: 80,
            }}
          />
          <Input
            title="Notas internas"
            register={{
              name: 'notes',
              onChange: async (e) => setNotes((e.target as HTMLInputElement).value),
              onBlur: async () => {},
              ref: () => {},
            }}
            inputConfig={{
              value: notes,
              placeholder: 'Contexto comercial, contato, vencimento…',
              maxLength: 500,
            }}
          />
          <div className="grid grid-cols-2 gap-3">
            {priceField('Mensal R$ (Stripe)', monthlyPrice, setMonthlyPrice, '900,00')}
            {priceField('Anual R$ (opcional)', yearlyPrice, setYearlyPrice, '9.600,00')}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {intField('Max orgs', maxOrgs, setMaxOrgs, '5')}
            {intField('Max pacientes', maxPatients, setMaxPatients, '1000')}
            {intField('Max membros', maxMembers, setMaxMembers, '5')}
          </div>

          {/* Capabilities — features comportamentais que separam tiers */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recursos liberados
            </label>
            <div className="grid sm:grid-cols-2 gap-2">
              <CapabilityToggle
                checked={auditLog}
                onChange={setAuditLog}
                title="Logs de auditoria"
                description="Histórico LGPD de quem mexeu em cada paciente."
              />
              <CapabilityToggle
                checked={customRoles}
                onChange={setCustomRoles}
                title="Cargos personalizados"
                description="Owner pode criar cargos com permissões customizadas."
              />
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending || !canSubmit}>
            {create.isPending ? 'Criando + Stripe…' : 'Criar plano'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── User detail dialog (modal — usado em navegação cruzada da OrgsTab) ────

function UserDetailDialog({
  userId,
  onClose,
  onOpenOrg,
}: {
  userId: string;
  onClose: () => void;
  onOpenOrg: (orgId: string) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'user-details', userId],
    queryFn: () => adminApi.getUserDetails(userId),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Detalhes do usuário</DialogTitle>
          <DialogDescription>
            Tudo que o painel de marketing/atendimento precisa pra entender quem é a pessoa.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="max-h-[75dvh]">
          {isLoading || !data ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <UserDetailContent data={data} onOpenOrg={onOpenOrg} />
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type UserTab = 'resumo' | 'orgs' | 'activity' | 'feedbacks';

function UserDetailContent({
  data,
  onOpenOrg,
  onBan,
  onUnban,
  inline,
}: {
  data: AdminUserDetails;
  onOpenOrg: (orgId: string) => void;
  onBan?: () => void;
  onUnban?: () => void;
  /** Quando renderizado dentro de um painel master/detail (não modal), aplica padding próprio. */
  inline?: boolean;
}) {
  const [tab, setTab] = useState<UserTab>('resumo');
  const ownerOrgs = data.members.filter((m) => m.role.includes('owner'));
  const memberOrgs = data.members.filter((m) => !m.role.includes('owner'));

  // Reset pra "resumo" quando troca de usuário (dataId muda)
  useEffect(() => {
    setTab('resumo');
  }, [data.id]);

  // Métricas agregadas — boas pra avaliar valor do cliente
  const totalMembersUnderRoof = ownerOrgs.reduce(
    (acc, m) => acc + m.organization._count.members,
    0,
  );
  const monthsSinceSignup = Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(data.createdAt).getTime()) /
        (1000 * 60 * 60 * 24 * 30),
    ),
  );
  const mrrContribution =
    data.customPlan &&
    (data.customPlan.stripeStatus === 'active' ||
      data.customPlan.stripeStatus === 'trialing')
      ? data.customPlan.monthlyPriceBRL
      : 0;

  return (
    <div className={cn('flex flex-col gap-5', inline && 'p-5')}>
      {/* Cabeçalho do usuário */}
      <div className="flex items-start gap-4 rounded-xl border bg-muted/20 p-4">
        <Avatar className="size-14">
          <AvatarImage src={data.image ?? ''} alt={data.name} />
          <AvatarFallback>{initials(data.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-semibold truncate">{data.name}</h3>
            {data.role === 'super_admin' && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary text-primary-foreground tracking-wide">
                SUPER
              </span>
            )}
            {data.role === 'admin' && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-700 dark:text-blue-400 tracking-wide">
                ADMIN
              </span>
            )}
            {data.banned && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground tracking-wide inline-flex items-center gap-1">
                <Ban className="size-3" /> BANIDO
              </span>
            )}
            {data.emailVerified ? (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
                <BadgeCheck className="size-3" /> verificado
              </span>
            ) : (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400">
                e-mail não verificado
              </span>
            )}
            {data.twoFactorEnabled && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground inline-flex items-center gap-1">
                <Shield className="size-3" /> 2FA
              </span>
            )}
          </div>
          <a
            href={`mailto:${data.email}`}
            className="text-sm text-primary hover:underline inline-flex items-center gap-1.5 mt-0.5"
          >
            <Mail className="size-3.5" />
            {data.email}
          </a>
          <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3" />
              Cadastro {format(new Date(data.createdAt), 'd MMM yyyy', { locale: ptBR })}
              {monthsSinceSignup > 0 &&
                ` · ${monthsSinceSignup} ${monthsSinceSignup === 1 ? 'mês' : 'meses'}`}
            </span>
            {data.lastSession && (
              <span className="inline-flex items-center gap-1">
                Último acesso{' '}
                {format(new Date(data.lastSession.createdAt), 'd MMM, HH:mm', {
                  locale: ptBR,
                })}
              </span>
            )}
            {data.activeSessions > 0 && (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <span className="size-1.5 rounded-full bg-current" />
                {data.activeSessions}{' '}
                {data.activeSessions === 1 ? 'sessão ativa' : 'sessões ativas'}
              </span>
            )}
            {data.stripeCustomerId && (
              <span
                className="font-mono inline-flex items-center gap-1 truncate max-w-[14rem]"
                title={data.stripeCustomerId}
              >
                <CreditCard className="size-3" />
                {data.stripeCustomerId}
              </span>
            )}
          </div>
        </div>
        {inline && data.role !== 'super_admin' && (
          <div className="flex flex-col gap-1 shrink-0">
            {data.banned ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={onUnban}
              >
                <CheckCircle2 className="size-3.5" />
                Desbanir
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-destructive hover:text-destructive"
                onClick={onBan}
              >
                <Ban className="size-3.5" />
                Banir
              </Button>
            )}
          </div>
        )}
      </div>

      {/* KPIs agregados — útil pra decisão de desconto/renovação */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MiniStat
          label="Orgs (owner)"
          value={ownerOrgs.length}
          highlight={ownerOrgs.length > 1}
        />
        <MiniStat label="Orgs (membro)" value={memberOrgs.length} />
        <MiniStat
          label="Membros sob ele"
          value={totalMembersUnderRoof}
          highlight={totalMembersUnderRoof > 5}
        />
        <MiniStat
          label="MRR / mês"
          value={mrrContribution}
          format={(v) =>
            v.toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
              maximumFractionDigits: 0,
            })
          }
          highlight={mrrContribution > 0}
        />
      </div>

      {/* Tabs internas — separa o ruído de visualização */}
      <div className="flex items-center gap-1 border-b -mx-1 px-1 overflow-x-auto">
        {(
          [
            { id: 'resumo', label: 'Resumo' },
            { id: 'orgs', label: `Organizações (${data.members.length})` },
            { id: 'activity', label: `Atividade (${data._count.auditLogs})` },
            { id: 'feedbacks', label: `Feedbacks (${data._count.feedbacks})` },
          ] as { id: UserTab; label: string }[]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap cursor-pointer',
              tab === t.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Resumo */}
      {tab === 'resumo' && (
        <div className="flex flex-col gap-4">
          <Section title="Plano">
            {data.customPlan ? (
              <div className="rounded-xl border-2 border-amber-500/40 bg-amber-500/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="size-9 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                    <Sparkles className="size-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{data.customPlan.name}</span>
                      {data.customPlan.stripeStatus && (
                        <span
                          className={cn(
                            'text-[10px] font-semibold px-1.5 py-0.5 rounded',
                            STRIPE_STATUS_STYLES[data.customPlan.stripeStatus]?.className ??
                              'bg-muted text-muted-foreground',
                          )}
                        >
                          {STRIPE_STATUS_STYLES[data.customPlan.stripeStatus]?.label ??
                            data.customPlan.stripeStatus}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      R$ {data.customPlan.monthlyPriceBRL.toFixed(2).replace('.', ',')}/mês
                      {' · '}
                      {data.customPlan.maxOrganizations} orgs ·{' '}
                      {data.customPlan.maxPatients} pacientes ·{' '}
                      {data.customPlan.maxMembers} membros
                    </div>
                    {data.customPlan.notes && (
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {data.customPlan.notes}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : data.subscriptions.length > 0 ? (
              <ul className="rounded-xl border divide-y divide-border">
                {data.subscriptions.map((sub) => (
                  <li
                    key={sub.id}
                    className="px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium capitalize">{sub.plan}</div>
                      <div className="text-xs text-muted-foreground">
                        {sub.periodEnd
                          ? `Renova em ${format(new Date(sub.periodEnd), 'd MMM yyyy', { locale: ptBR })}`
                          : 'Sem período definido'}
                      </div>
                    </div>
                    <span
                      className={cn(
                        'text-[10px] font-semibold px-1.5 py-0.5 rounded',
                        STRIPE_STATUS_STYLES[sub.status]?.className ??
                          'bg-muted text-muted-foreground',
                      )}
                    >
                      {STRIPE_STATUS_STYLES[sub.status]?.label ?? sub.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Plano free — sem assinatura ativa.
              </p>
            )}
          </Section>

          {/* Quick recap das orgs */}
          <Section title="Organizações (resumo)">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Crown className="size-3 text-amber-600 dark:text-amber-400" />
                  Como owner
                </div>
                <div className="text-2xl font-bold">{ownerOrgs.length}</div>
                {ownerOrgs.length > 0 && (
                  <div className="text-[10px] text-muted-foreground mt-1 truncate">
                    {ownerOrgs.map((m) => m.organization.name).join(', ')}
                  </div>
                )}
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <UserPlus className="size-3" />
                  Como membro
                </div>
                <div className="text-2xl font-bold">{memberOrgs.length}</div>
                {memberOrgs.length > 0 && (
                  <div className="text-[10px] text-muted-foreground mt-1 truncate">
                    {memberOrgs.map((m) => m.organization.name).join(', ')}
                  </div>
                )}
              </div>
            </div>
          </Section>

          {data.banned && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
                <Ban className="size-4" /> Usuário banido
              </div>
              {data.banReason && (
                <p className="text-sm mt-2">
                  <span className="font-medium">Motivo: </span>
                  {data.banReason}
                </p>
              )}
              {data.banObservation && (
                <p className="text-xs text-muted-foreground mt-1.5 whitespace-pre-wrap">
                  {data.banObservation}
                </p>
              )}
              {data.bannedAt && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  Banido em{' '}
                  {format(
                    new Date(data.bannedAt),
                    "d 'de' MMMM 'de' yyyy, HH:mm",
                    { locale: ptBR },
                  )}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab: Organizações */}
      {tab === 'orgs' && (
        <div className="flex flex-col gap-4">
          <Section
            title={`Como owner (${ownerOrgs.length})`}
            icon={<Crown className="size-4 text-amber-600 dark:text-amber-400" />}
          >
            {ownerOrgs.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                Não é owner de nenhuma organização.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {ownerOrgs.map((m) => (
                  <OrgInUserDetail
                    key={m.id}
                    org={m.organization}
                    memberSince={m.createdAt}
                    onOpen={() => onOpenOrg(m.organization.id)}
                    self={data.id}
                  />
                ))}
              </div>
            )}
          </Section>

          <Section
            title={`Como membro (${memberOrgs.length})`}
            icon={<UserPlus className="size-4 text-muted-foreground" />}
          >
            {memberOrgs.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                Não é membro de nenhuma outra organização.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {memberOrgs.map((m) => (
                  <OrgInUserDetail
                    key={m.id}
                    org={m.organization}
                    memberSince={m.createdAt}
                    onOpen={() => onOpenOrg(m.organization.id)}
                    self={data.id}
                    roleLabel={m.role}
                  />
                ))}
              </div>
            )}
          </Section>
        </div>
      )}

      {/* Tab: Atividade — audit logs com filtros */}
      {tab === 'activity' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="Feedbacks" value={data._count.feedbacks} />
            <MiniStat label="Audit logs" value={data._count.auditLogs} />
            <MiniStat label="Convites enviados" value={data._count.invitations} />
          </div>
          <AuditLogsPanel scope={{ userId: data.id }} />
        </div>
      )}

      {/* Tab: Feedbacks enviados */}
      {tab === 'feedbacks' && (
        <div>
          {data.recentFeedbacks.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              Nenhum feedback enviado por este usuário.
            </p>
          ) : (
            <ul className="rounded-xl border divide-y divide-border">
              {data.recentFeedbacks.map((f) => (
                <li key={f.id} className="px-3 py-2.5 text-xs flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{f.subject}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={cn(
                          'text-[10px] font-semibold px-1.5 py-0.5 rounded',
                          FEEDBACK_TYPES[f.type]?.className ??
                            'bg-muted text-muted-foreground',
                        )}
                      >
                        {FEEDBACK_TYPES[f.type]?.label ?? f.type}
                      </span>
                      <span
                        className={cn(
                          'text-[10px] font-semibold px-1.5 py-0.5 rounded',
                          f.status === 'new'
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {f.status}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(f.createdAt), 'd MMM, HH:mm', { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {f.message}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function OrgInUserDetail({
  org,
  memberSince,
  onOpen,
  self,
  roleLabel,
}: {
  org: AdminUserDetails['members'][number]['organization'];
  memberSince: string;
  /** Abre a org no modal de detalhe completo. */
  onOpen: () => void;
  self: string;
  roleLabel?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const otherMembers = org.members.filter((m) => m.user.id !== self);
  const owners = org.members.filter((m) => m.role.includes('owner'));
  const isOwner = !roleLabel;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors cursor-pointer"
        >
          <div className="size-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Building2 className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
              {org.name}
              {org.banned && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">
                  BANIDA
                </span>
              )}
              {!isOwner && roleLabel && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {roleLabel}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              /{org.slug} · {org._count.members} {org._count.members === 1 ? 'membro' : 'membros'}
              {' · desde '}
              {format(new Date(memberSince), 'd MMM yyyy', { locale: ptBR })}
            </div>
          </div>
          <ChevronRight
            className={cn(
              'size-4 text-muted-foreground shrink-0 transition-transform',
              expanded && 'rotate-90',
            )}
          />
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="px-3 border-l text-[11px] text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors cursor-pointer flex items-center"
          title="Abrir página completa da organização"
        >
          Abrir
        </button>
      </div>

      {/* Lista resumida de outros membros — sempre visível */}
      {otherMembers.length > 0 && (
        <div className="px-3 py-2 border-t bg-muted/20">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">
            {isOwner ? 'Membros desta organização' : 'Outros membros'}
          </div>
          <ul className="flex flex-col gap-1">
            {otherMembers.slice(0, expanded ? otherMembers.length : 6).map((m) => (
              <li key={m.id} className="flex items-center gap-2 text-xs">
                <Avatar className="size-5">
                  <AvatarImage src={m.user.image ?? ''} alt={m.user.name} />
                  <AvatarFallback className="text-[8px]">{initials(m.user.name)}</AvatarFallback>
                </Avatar>
                <span className="font-medium truncate flex-1">{m.user.name}</span>
                <span className="text-muted-foreground capitalize text-[10px]">
                  {m.role.includes('owner') ? 'owner' : m.role}
                </span>
              </li>
            ))}
            {!expanded && otherMembers.length > 6 && (
              <li className="text-[10px] text-muted-foreground italic pl-7">
                + {otherMembers.length - 6} outros (clique pra expandir)
              </li>
            )}
          </ul>
          {!isOwner && owners.length > 0 && (
            <div className="text-[10px] text-muted-foreground mt-1.5 pl-7">
              Owner: {owners.map((o) => o.user.name).join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Atividade da org com toggle "só esta pessoa / toda a org" */}
      {expanded && (
        <div className="px-3 py-3 border-t bg-muted/10">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">
            Atividade nesta organização
          </div>
          <AuditLogsPanel
            scope={{ userId: self, organizationId: org.id }}
            allowOrgWideToggle
          />
        </div>
      )}
    </div>
  );
}

// ─── Org detail drawer ─────────────────────────────────────────────────────

function OrgDetailPanel({
  orgId,
  onOpenUser,
  onBan,
  onUnban,
}: {
  orgId: string;
  onOpenUser: (userId: string) => void;
  onBan: (org: AdminOrg) => void;
  onUnban: (org: AdminOrg) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'org-details', orgId],
    queryFn: () => adminApi.getOrgDetails(orgId),
  });

  if (isLoading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="overflow-y-auto flex-1">
      <OrgDetailContent
        data={data}
        onOpenUser={onOpenUser}
        onBan={() => onBan(data as unknown as AdminOrg)}
        onUnban={() => onUnban(data as unknown as AdminOrg)}
        inline
      />
    </div>
  );
}

function OrgDetailContent({
  data,
  onOpenUser,
  onBan,
  onUnban,
  inline,
}: {
  data: AdminOrgDetails;
  onOpenUser: (userId: string) => void;
  onBan?: () => void;
  onUnban?: () => void;
  inline?: boolean;
}) {
  const owner = data.members.find((m) => m.role.includes('owner'));
  const otherMembers = data.members.filter((m) => !m.role.includes('owner'));

  // KPIs agregados — utilidade pra entender saúde da conta
  const ownerSub = data.ownerSubscriptions[0];
  const customPlanMRR = owner?.user.customPlan
    ? owner.user.customPlan.monthlyPriceBRL
    : 0;
  const ageMonths = Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(data.createdAt).getTime()) /
        (1000 * 60 * 60 * 24 * 30),
    ),
  );

  return (
    <div className={cn('flex flex-col gap-5', inline && 'p-5')}>
      {/* Header */}
      <div className="flex items-start gap-4 rounded-xl border bg-muted/20 p-4">
        <div className="size-14 rounded-xl bg-muted flex items-center justify-center shrink-0">
          <Building2 className="size-6 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-semibold truncate">{data.name}</h3>
            {data.banned && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground tracking-wide inline-flex items-center gap-1">
                <Ban className="size-3" /> BANIDA
              </span>
            )}
            {owner?.user.customPlan && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 inline-flex items-center gap-1">
                <Sparkles className="size-3" />
                {owner.user.customPlan.name}
              </span>
            )}
            {ownerSub && (
              <span
                className={cn(
                  'text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize',
                  STRIPE_STATUS_STYLES[ownerSub.status]?.className ??
                    'bg-muted text-muted-foreground',
                )}
              >
                {ownerSub.plan}
              </span>
            )}
          </div>
          <div className="text-sm text-muted-foreground">/{data.slug}</div>
          <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3" />
              Criada {format(new Date(data.createdAt), 'd MMM yyyy', { locale: ptBR })}
              {ageMonths > 0 && ` · ${ageMonths} ${ageMonths === 1 ? 'mês' : 'meses'}`}
            </span>
          </div>
        </div>
        {inline && (
          <div className="flex flex-col gap-1 shrink-0">
            {data.banned ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={onUnban}
              >
                <CheckCircle2 className="size-3.5" />
                Desbanir
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-destructive hover:text-destructive"
                onClick={onBan}
              >
                <Ban className="size-3.5" />
                Banir
              </Button>
            )}
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MiniStat
          label="Membros"
          value={data._count.members}
          highlight={data._count.members > 3}
        />
        <MiniStat
          label="Convites pend."
          value={data._count.invitations}
        />
        <MiniStat label="Eventos" value={data._count.auditLogs} />
        <MiniStat
          label="MRR (custom)"
          value={customPlanMRR}
          format={(v) =>
            v > 0
              ? v.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  maximumFractionDigits: 0,
                })
              : '—'
          }
          highlight={customPlanMRR > 0}
        />
      </div>

      {/* Owner */}
      <Section title="Owner" icon={<Crown className="size-4 text-amber-600 dark:text-amber-400" />}>
        {owner ? (
          <button
            type="button"
            onClick={() => onOpenUser(owner.user.id)}
            className="w-full flex items-center gap-3 rounded-xl border bg-card p-3 text-left hover:bg-muted/30 transition-colors cursor-pointer"
          >
            <Avatar className="size-10">
              <AvatarImage src={owner.user.image ?? ''} alt={owner.user.name} />
              <AvatarFallback className="text-xs">{initials(owner.user.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{owner.user.name}</div>
              <div className="text-xs text-muted-foreground truncate">{owner.user.email}</div>
            </div>
            {owner.user.customPlan && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 inline-flex items-center gap-1">
                <Sparkles className="size-3" />
                {owner.user.customPlan.name}
              </span>
            )}
            {data.ownerSubscriptions[0] && (
              <span
                className={cn(
                  'text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize',
                  STRIPE_STATUS_STYLES[data.ownerSubscriptions[0].status]?.className ??
                    'bg-muted text-muted-foreground',
                )}
              >
                {data.ownerSubscriptions[0].plan}
              </span>
            )}
            <ChevronRight className="size-4 text-muted-foreground shrink-0" />
          </button>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Esta organização não tem owner — pode ter sido órfã após exclusão.
          </p>
        )}
      </Section>

      {/* Membros */}
      <Section title={`Membros (${data._count.members})`}>
        {otherMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Apenas o owner.</p>
        ) : (
          <ul className="rounded-xl border divide-y divide-border">
            {otherMembers.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onOpenUser(m.user.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <Avatar className="size-8">
                    <AvatarImage src={m.user.image ?? ''} alt={m.user.name} />
                    <AvatarFallback className="text-[10px]">{initials(m.user.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{m.user.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{m.user.email}</div>
                  </div>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">
                    {m.role}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline">
                    desde {format(new Date(m.createdAt), 'd MMM yyyy', { locale: ptBR })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Convites pendentes */}
      {data.invitations.length > 0 && (
        <Section title={`Convites pendentes (${data.invitations.length})`}>
          <ul className="rounded-xl border divide-y divide-border">
            {data.invitations.map((inv) => (
              <li key={inv.id} className="px-3 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{inv.email}</div>
                  <div className="text-xs text-muted-foreground">
                    convidado por {inv.inviter.name}
                    {' · '}
                    expira{' '}
                    {format(new Date(inv.expiresAt), 'd MMM, HH:mm', {
                      locale: ptBR,
                    })}
                  </div>
                </div>
                {inv.role && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize shrink-0">
                    {inv.role}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Cargos personalizados */}
      {data.organizationRoles.length > 0 && (
        <Section title={`Cargos personalizados (${data.organizationRoles.length})`}>
          <ul className="rounded-xl border divide-y divide-border">
            {data.organizationRoles.map((r) => (
              <li key={r.id} className="px-3 py-2 flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{r.role}</span>
                <code className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded truncate max-w-[60%]">
                  {r.permission}
                </code>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Atividade — com filtros, paginação e visão completa */}
      <Section title="Atividade">
        <AuditLogsPanel scope={{ organizationId: data.id }} />
      </Section>

      {data.banned && data.banReason && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
            <Ban className="size-4" /> Organização banida
          </div>
          <p className="text-sm mt-2">
            <span className="font-medium">Motivo: </span>
            {data.banReason}
          </p>
          {data.banObservation && (
            <p className="text-xs text-muted-foreground mt-1.5 whitespace-pre-wrap">
              {data.banObservation}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Audit logs panel — usado no detalhe de user e de org ────────────────

interface AuditScope {
  userId?: string;
  organizationId?: string;
}

const PERIOD_OPTIONS = [
  { value: '', label: 'Sempre' },
  { value: '24h', label: 'Últimas 24h' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '90d', label: 'Últimos 90 dias' },
];

function periodToDates(period: string): {
  dateFrom?: string;
  dateTo?: string;
} {
  if (!period) return {};
  const now = new Date();
  const from = new Date();
  const days = { '24h': 1, '7d': 7, '30d': 30, '90d': 90 }[period];
  if (!days) return {};
  from.setDate(from.getDate() - days);
  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: now.toISOString().slice(0, 10),
  };
}

function AuditLogsPanel({
  scope,
  /** Quando true, mostra um toggle "só esta pessoa / todos da org" — válido só
   *  quando scope tem ambos userId+organizationId. */
  allowOrgWideToggle,
}: {
  scope: AuditScope;
  allowOrgWideToggle?: boolean;
}) {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [resource, setResource] = useState('');
  const [period, setPeriod] = useState('');
  // Quando ambos userId e organizationId estão presentes, este toggle decide
  // se filtramos por userId (default) ou mostramos toda a org.
  const [orgWide, setOrgWide] = useState(false);

  const { dateFrom, dateTo } = periodToDates(period);

  const effectiveScope: AuditScope = useMemo(() => {
    if (allowOrgWideToggle && orgWide) {
      // Drop userId, mantém só organizationId
      return { organizationId: scope.organizationId };
    }
    return scope;
  }, [scope, allowOrgWideToggle, orgWide]);

  const { data, isLoading } = useQuery({
    queryKey: [
      'admin',
      'audit-logs',
      effectiveScope,
      page,
      action,
      resource,
      dateFrom,
      dateTo,
    ],
    queryFn: () =>
      adminApi.listAuditLogs({
        page,
        limit: 25,
        userId: effectiveScope.userId,
        organizationId: effectiveScope.organizationId,
        action: action || undefined,
        resource: resource || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
    placeholderData: (prev) => prev,
  });

  const { data: filterOpts } = useQuery({
    queryKey: ['admin', 'audit-logs', 'filter-options', effectiveScope],
    queryFn: () => adminApi.getAuditFilterOptions(effectiveScope),
  });

  const actionOptions = [
    { value: '', label: 'Todas as ações' },
    ...(filterOpts?.actions.map((a) => ({
      value: a.value,
      label: `${a.value} (${a.count})`,
    })) ?? []),
  ];
  const resourceOptions = [
    { value: '', label: 'Todos os recursos' },
    ...(filterOpts?.resources.map((r) => ({
      value: r.value,
      label: `${r.value} (${r.count})`,
    })) ?? []),
  ];

  const hasActiveFilter = !!action || !!resource || !!period || orgWide;

  const clearFilters = () => {
    setAction('');
    setResource('');
    setPeriod('');
    setOrgWide(false);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-2.5">
      {/* Toggle org-wide */}
      {allowOrgWideToggle && scope.userId && scope.organizationId && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Mostrar:</span>
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => {
                setOrgWide(false);
                setPage(1);
              }}
              className={cn(
                'px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
                !orgWide
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card hover:bg-muted/50',
              )}
            >
              Só esta pessoa
            </button>
            <button
              type="button"
              onClick={() => {
                setOrgWide(true);
                setPage(1);
              }}
              className={cn(
                'px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer border-l',
                orgWide
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card hover:bg-muted/50',
              )}
            >
              Toda a organização
            </button>
          </div>
        </div>
      )}

      {/* Filtros — todos selects pra ficar consistente */}
      <div className="grid sm:grid-cols-3 gap-2">
        <FilterSelect
          name="audit-action"
          label="Ação"
          options={actionOptions}
          value={action}
          onChange={(v) => {
            setAction(v);
            setPage(1);
          }}
        />
        <FilterSelect
          name="audit-resource"
          label="Recurso"
          options={resourceOptions}
          value={resource}
          onChange={(v) => {
            setResource(v);
            setPage(1);
          }}
        />
        <FilterSelect
          name="audit-period"
          label="Período"
          options={PERIOD_OPTIONS}
          value={period}
          onChange={(v) => {
            setPeriod(v);
            setPage(1);
          }}
        />
      </div>

      {hasActiveFilter && (
        <button
          type="button"
          onClick={clearFilters}
          className="text-[11px] text-primary hover:underline self-start cursor-pointer"
        >
          Limpar filtros
        </button>
      )}

      {/* Lista */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {isLoading && !data ? (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">
            Carregando…
          </div>
        ) : !data || data.data.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">
            Nenhum log encontrado.
          </div>
        ) : (
          <ul className="divide-y divide-border max-h-72 overflow-auto">
            {data.data.map((log) => (
              <AuditLogRow key={log.id} log={log} />
            ))}
          </ul>
        )}
        {data && data.totalPages > 1 && (
          <div className="px-3 py-2 border-t flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">
              {data.page}/{data.totalPages} · {data.total} logs
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ←
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                →
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterSelect({
  name,
  label,
  options,
  value,
  onChange,
}: {
  name: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
        {label}
      </span>
      <Input
        title=""
        className={{ classNameLabel: 'hidden' }}
        register={{
          name,
          onChange: async () => {},
          onBlur: async () => {},
          ref: () => {},
        }}
        select={{
          options,
          value,
          onChange,
          notFilter: true,
        }}
      />
    </div>
  );
}

function AuditLogRow({ log }: { log: AdminAuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const hasMeta =
    log.metadata != null &&
    typeof log.metadata === 'object' &&
    Object.keys(log.metadata as Record<string, unknown>).length > 0;

  return (
    <li className="px-3 py-2 text-xs">
      <div className="flex items-start gap-2">
        <Avatar className="size-6 mt-0.5">
          <AvatarImage src={log.user.image ?? ''} alt={log.user.name} />
          <AvatarFallback className="text-[8px]">
            {initials(log.user.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium truncate">{log.user.name}</span>
            <span className="text-muted-foreground capitalize">{log.action}</span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {log.resource}
            </span>
            {log.organization && (
              <span className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5">
                <Building2 className="size-2.5" />
                {log.organization.name}
              </span>
            )}
          </div>
          {log.resourceId && (
            <span className="text-[10px] text-muted-foreground font-mono">
              id: {log.resourceId.slice(0, 12)}
              {log.resourceId.length > 12 ? '…' : ''}
            </span>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-[10px] text-muted-foreground">
            {format(new Date(log.createdAt), 'd MMM, HH:mm', { locale: ptBR })}
          </span>
          {hasMeta && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-[10px] text-primary hover:underline cursor-pointer"
            >
              {expanded ? 'ocultar' : 'metadata'}
            </button>
          )}
        </div>
      </div>
      {expanded && hasMeta && (
        <pre className="mt-1.5 text-[10px] text-muted-foreground bg-muted/30 rounded-md p-2 overflow-auto max-h-40">
          {JSON.stringify(log.metadata, null, 2)}
        </pre>
      )}
    </li>
  );
}

// ─── Helpers de drawer ────────────────────────────────────────────────────

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h4>
      </div>
      {children}
    </div>
  );
}

function MiniStat({
  label,
  value,
  format,
  highlight,
}: {
  label: string;
  value: number;
  format?: (v: number) => string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-card px-3 py-2.5 text-center',
        highlight && 'border-primary/40 bg-primary/5',
      )}
    >
      <div className={cn('text-lg font-bold', highlight && 'text-primary')}>
        {format ? format(value) : value}
      </div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
    </div>
  );
}

function CapabilityToggle({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'text-left rounded-lg border bg-card p-3 transition-all cursor-pointer flex items-start gap-3',
        checked ? 'border-primary/40 bg-primary/5' : 'hover:border-primary/30',
      )}
    >
      <div
        className={cn(
          'mt-0.5 size-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
          checked
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-muted-foreground/40 bg-background',
        )}
      >
        {checked && <CheckCircle2 className="size-3.5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</div>
      </div>
    </button>
  );
}
