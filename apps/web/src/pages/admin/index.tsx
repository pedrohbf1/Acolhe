import Input from '@/components/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
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
  type AdminCustomPlan,
  type AdminFeedback,
  type AdminOrg,
  type AdminUser,
} from '@/lib/admin-api';
import { cn } from '@/lib/utils';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertCircle,
  Ban,
  Building2,
  CheckCircle2,
  KeyRound,
  Loader2,
  LogOut,
  MailQuestion,
  MessageSquare,
  Plus,
  Receipt,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Unlock,
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
              Olá <strong className="text-foreground">{userName}</strong>.
              Digite a passphrase mestre pra destrancar o painel. A sessão dura
              60 minutos.
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
              Tentativas falhas são logadas. Em caso de comprometimento,
              alterne a passphrase pelo script <code>hash-admin-passphrase.ts</code>{' '}
              e atualize o <code>.env</code>.
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

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
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
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto">
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
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
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminApi.stats(),
  });

  if (isLoading || !stats) return <Loader2 className="size-5 animate-spin" />;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <StatBox
        icon={<MessageSquare className="size-5 text-primary" />}
        label="Feedbacks"
        value={stats.feedbacks}
        sub={`${stats.newFeedbacks} novos`}
        onClick={() => onNav('feedbacks')}
        urgent={stats.newFeedbacks > 0}
      />
      <StatBox
        icon={<Users className="size-5 text-primary" />}
        label="Usuários"
        value={stats.users}
        sub={
          stats.bannedUsers > 0 ? `${stats.bannedUsers} banidos` : 'todos ok'
        }
        onClick={() => onNav('users')}
      />
      <StatBox
        icon={<Building2 className="size-5 text-primary" />}
        label="Organizações"
        value={stats.orgs}
        sub={
          stats.bannedOrgs > 0 ? `${stats.bannedOrgs} banidas` : 'todas ok'
        }
        onClick={() => onNav('orgs')}
      />
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
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub?: string;
  onClick: () => void;
  urgent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'text-left rounded-xl border bg-card p-5 transition-all cursor-pointer',
        'hover:border-primary/40 hover:shadow-sm',
        urgent && 'ring-2 ring-amber-500/20 border-amber-500/40',
      )}
    >
      <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
        {icon}
      </div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">
        {label}
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {sub && (
        <div className="text-xs text-muted-foreground mt-1">{sub}</div>
      )}
    </button>
  );
}

// ─── Feedbacks ─────────────────────────────────────────────────────────────

const FEEDBACK_STATUS_LABELS: Record<string, string> = {
  new: 'Novo',
  read: 'Lido',
  replied: 'Respondido',
  archived: 'Arquivado',
};
const FEEDBACK_STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  ...Object.entries(FEEDBACK_STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
];

function FeedbacksTab() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'feedbacks', page, statusFilter],
    queryFn: () =>
      adminApi.listFeedbacks({
        page,
        limit: 25,
        status: statusFilter || undefined,
      }),
  });

  const updateStatus = useMutation({
    mutationFn: (input: { id: string; status: string }) =>
      adminApi.updateFeedback(input.id, { status: input.status }),
    onSuccess: () => {
      toast.success('Status atualizado.');
      qc.invalidateQueries({ queryKey: ['admin', 'feedbacks'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-base font-semibold">Feedbacks</h2>
        <div className="w-48">
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
              options: FEEDBACK_STATUS_OPTIONS,
              value: statusFilter,
              onChange: (v) => {
                setStatusFilter(v);
                setPage(1);
              },
              notFilter: true,
            }}
          />
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
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
              Quando alguém enviar pela /feedback, aparece aqui.
            </p>
          </div>
        )}
        {data && data.data.length > 0 && (
          <ul className="divide-y divide-border">
            {data.data.map((f) => (
              <FeedbackRow
                key={f.id}
                feedback={f}
                onChangeStatus={(s) =>
                  updateStatus.mutate({ id: f.id, status: s })
                }
              />
            ))}
          </ul>
        )}
        {data && data.totalPages > 1 && (
          <div className="px-6 py-3 border-t flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Página {data.page} / {data.totalPages} · {data.total} total
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const STATUS_OPTIONS = Object.entries(FEEDBACK_STATUS_LABELS).map(
  ([value, label]) => ({ value, label }),
);

function FeedbackRow({
  feedback,
  onChangeStatus,
}: {
  feedback: AdminFeedback;
  onChangeStatus: (status: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isNew = feedback.status === 'new';

  return (
    <li
      className={cn(
        'px-6 py-4 transition-colors',
        isNew ? 'bg-amber-500/5' : 'hover:bg-muted/30',
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar className="size-9 mt-0.5">
          <AvatarImage src={feedback.user?.image ?? ''} alt={feedback.user?.name ?? ''} />
          <AvatarFallback className="text-xs">
            {initials(feedback.user?.name ?? '?')}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{feedback.user?.name}</span>
            <span className="text-[11px] uppercase font-semibold tracking-wide text-muted-foreground">
              {feedback.type}
            </span>
            {isNew && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-white">
                NOVO
              </span>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              {format(new Date(feedback.createdAt), "d MMM, HH:mm", {
                locale: ptBR,
              })}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {feedback.user?.email}
          </div>
          <div className="text-sm font-semibold mt-2">{feedback.subject}</div>
          <div
            className={cn(
              'text-sm text-muted-foreground mt-1 leading-relaxed whitespace-pre-wrap',
              !expanded && 'line-clamp-2',
            )}
          >
            {feedback.message}
          </div>
          {feedback.message.length > 120 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-primary hover:underline mt-1"
            >
              {expanded ? 'Ocultar' : 'Ver completo'}
            </button>
          )}
        </div>
        <div className="w-36 shrink-0">
          <Input
            title=""
            className={{ classNameLabel: 'hidden' }}
            register={{
              name: `status-${feedback.id}`,
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
    </li>
  );
}

// ─── Users ─────────────────────────────────────────────────────────────────

function UsersTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [banTarget, setBanTarget] = useState<AdminUser | null>(null);
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

  const unban = useMutation({
    mutationFn: (id: string) => adminApi.unbanUser(id),
    onSuccess: () => {
      toast.success('Usuário desbanido.');
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-base font-semibold">Usuários</h2>
        <div className="relative w-full sm:w-64">
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

      <div className="rounded-xl border bg-card overflow-hidden">
        {isLoading && (
          <div className="px-6 py-8 text-sm text-muted-foreground text-center">
            Carregando…
          </div>
        )}
        {data && (
          <ul className="divide-y divide-border">
            {data.data.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                onBan={() => setBanTarget(u)}
                onUnban={() => unban.mutate(u.id)}
              />
            ))}
          </ul>
        )}
        {data && data.totalPages > 1 && (
          <div className="px-6 py-3 border-t flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Página {data.page} / {data.totalPages} · {data.total} total
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>

      {banTarget && (
        <BanUserDialog
          user={banTarget}
          onClose={() => setBanTarget(null)}
        />
      )}
    </div>
  );
}

function UserRow({
  user,
  onBan,
  onUnban,
}: {
  user: AdminUser;
  onBan: () => void;
  onUnban: () => void;
}) {
  return (
    <li className="px-6 py-3 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors flex-wrap">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Avatar className="size-9">
          <AvatarImage src={user.image ?? ''} alt={user.name} />
          <AvatarFallback className="text-xs">
            {initials(user.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
            {user.name}
            {user.role === 'super_admin' && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary text-primary-foreground tracking-wide">
                SUPER
              </span>
            )}
            {user.role === 'admin' && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-700 dark:text-blue-400 tracking-wide">
                ADMIN
              </span>
            )}
            {user.banned && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground tracking-wide inline-flex items-center gap-1">
                <Ban className="size-3" />
                BANIDO
              </span>
            )}
            {user.customPlan && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 inline-flex items-center gap-1">
                <Sparkles className="size-3" />
                {user.customPlan.name}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {user.email}
          </div>
          {user.banned && user.banReason && (
            <div className="text-xs text-destructive mt-0.5 truncate">
              {user.banReason}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground">
          {user._count.members}{' '}
          {user._count.members === 1 ? 'org' : 'orgs'}
        </span>
        {user.banned ? (
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
          user.role !== 'super_admin' && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={onBan}
            >
              <Ban className="size-3.5" />
              Banir
            </Button>
          )
        )}
      </div>
    </li>
  );
}

function BanUserDialog({
  user,
  onClose,
}: {
  user: AdminUser;
  onClose: () => void;
}) {
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
            O usuário verá uma tela com motivo + observação ao acessar o app.
            Sessões ativas continuam funcionando até o logout.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Input
            title="Motivo (obrigatório)"
            register={{
              name: 'reason',
              onChange: async (e) =>
                setReason((e.target as HTMLInputElement).value),
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
              onChange: async (e) =>
                setObservation((e.target as HTMLTextAreaElement).value),
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
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={ban.isPending}
          >
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
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['admin', 'orgs', page, search],
    queryFn: () =>
      adminApi.listOrgs({
        page,
        limit: 25,
        search: search || undefined,
      }),
  });

  const unban = useMutation({
    mutationFn: (id: string) => adminApi.unbanOrg(id),
    onSuccess: () => {
      toast.success('Organização desbanida.');
      qc.invalidateQueries({ queryKey: ['admin', 'orgs'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-base font-semibold">Organizações</h2>
        <div className="relative w-full sm:w-64">
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

      <div className="rounded-xl border bg-card overflow-hidden">
        {data && (
          <ul className="divide-y divide-border">
            {data.data.map((o) => (
              <li
                key={o.id}
                className="px-6 py-3 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors flex-wrap"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="size-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Building2 className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                      {o.name}
                      {o.banned && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground tracking-wide inline-flex items-center gap-1">
                          <Ban className="size-3" /> BANIDA
                        </span>
                      )}
                      {o.customPlan && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 inline-flex items-center gap-1">
                          <Sparkles className="size-3" />
                          {o.customPlan.name}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      /{o.slug} · {o._count.members}{' '}
                      {o._count.members === 1 ? 'membro' : 'membros'}
                    </div>
                    {o.banned && o.banReason && (
                      <div className="text-xs text-destructive mt-0.5 truncate">
                        {o.banReason}
                      </div>
                    )}
                  </div>
                </div>
                {o.banned ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => unban.mutate(o.id)}
                  >
                    <CheckCircle2 className="size-3.5" />
                    Desbanir
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => setBanTarget(o)}
                  >
                    <Ban className="size-3.5" />
                    Banir
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {banTarget && (
        <BanOrgDialog org={banTarget} onClose={() => setBanTarget(null)} />
      )}
    </div>
  );
}

function BanOrgDialog({
  org,
  onClose,
}: {
  org: AdminOrg;
  onClose: () => void;
}) {
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
            Membros perdem acesso. Motivo e observação são exibidos a quem
            tentar acessar.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Input
            title="Motivo"
            register={{
              name: 'reason',
              onChange: async (e) =>
                setReason((e.target as HTMLInputElement).value),
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
              onChange: async (e) =>
                setObservation((e.target as HTMLTextAreaElement).value),
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
        </div>
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

const STRIPE_STATUS_STYLES: Record<
  string,
  { label: string; className: string }
> = {
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
  const [deleteTarget, setDeleteTarget] = useState<AdminCustomPlan | null>(
    null,
  );
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
            Limites e preço para um cliente específico (1:1). Cria Product +
            Price + Subscription na Stripe automaticamente — cobrança rola pelo
            cartão padrão do usuário.
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
            Crie um plano sob medida pra um cliente — Stripe cobra
            automaticamente.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((p) => (
          <CustomPlanCard
            key={p.id}
            plan={p}
            onDelete={() => setDeleteTarget(p)}
          />
        ))}
      </div>

      {creating && <CreatePlanDialog onClose={() => setCreating(false)} />}

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Excluir plano "{deleteTarget?.name}"?
            </DialogTitle>
            <DialogDescription>
              A subscription Stripe será cancelada (sem reembolso automático)
              e o plano será removido de{' '}
              <strong>{deleteTarget?.user.name}</strong>. O usuário cai pra
              Free a partir desse momento.
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
              onClick={() =>
                deleteTarget && remove.mutate(deleteTarget.id)
              }
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

function CustomPlanCard({
  plan,
  onDelete,
}: {
  plan: AdminCustomPlan;
  onDelete: () => void;
}) {
  const status = plan.stripeStatus
    ? STRIPE_STATUS_STYLES[plan.stripeStatus] ?? {
        label: plan.stripeStatus,
        className: 'bg-muted text-muted-foreground',
      }
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
            <div className="text-xs text-muted-foreground line-clamp-2">
              {plan.notes}
            </div>
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
          <AvatarFallback className="text-[10px]">
            {initials(plan.user.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="text-xs font-medium truncate">{plan.user.name}</div>
          <div className="text-[10px] text-muted-foreground truncate">
            {plan.user.email}
          </div>
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
          <span
            className={cn(
              'text-[10px] font-semibold px-1.5 py-0.5 rounded',
              status.className,
            )}
          >
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
  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [monthlyPrice, setMonthlyPrice] = useState('');
  const [yearlyPrice, setYearlyPrice] = useState('');
  const [maxOrgs, setMaxOrgs] = useState('5');
  const [maxPatients, setMaxPatients] = useState('1000');
  const [maxMembers, setMaxMembers] = useState('5');
  const qc = useQueryClient();

  // Busca de usuários (autocomplete)
  const { data: searchResults } = useQuery({
    queryKey: ['admin', 'users-search', userSearch],
    queryFn: () =>
      adminApi.listUsers({
        page: 1,
        limit: 10,
        search: userSearch || undefined,
      }),
    enabled: userSearch.length >= 2,
  });

  // Quando seleciona o user, sugere o nome do plano se ainda vazio
  const handlePickUser = (u: AdminUser) => {
    setSelectedUser(u);
    if (!name) setName(`Personalizado — ${u.name.split(' ')[0]}`);
  };

  const create = useMutation({
    mutationFn: () => {
      if (!selectedUser) throw new Error('Selecione um usuário');
      const monthly = Number(monthlyPrice);
      if (!monthly || monthly <= 0) throw new Error('Preço mensal inválido');
      const yearly = yearlyPrice ? Number(yearlyPrice) : undefined;
      return adminApi.createCustomPlan({
        userId: selectedUser.id,
        name,
        notes: notes || undefined,
        monthlyPriceBRL: monthly,
        yearlyPriceBRL: yearly,
        maxOrganizations: Number(maxOrgs),
        maxPatients: Number(maxPatients),
        maxMembers: Number(maxMembers),
        auditLog: true,
        customRoles: true,
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

  const numField = (
    title: string,
    value: string,
    setter: (v: string) => void,
    placeholder?: string,
  ) => (
    <Input
      title={title}
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

  const canSubmit =
    !!selectedUser &&
    !!name &&
    !!monthlyPrice &&
    !!maxOrgs &&
    !!maxPatients &&
    !!maxMembers;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo plano customizado</DialogTitle>
          <DialogDescription>
            Plano 1:1 com um cliente. Stripe cria Product + Price + Subscription
            automaticamente. Cobrança rola via cartão default do usuário (se
            não tiver, status fica <em>incomplete</em> até ele configurar).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 max-h-[65dvh] overflow-y-auto pr-1">
          {/* Selecionar usuário */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Usuário (1:1)
            </label>

            {selectedUser ? (
              <div className="flex items-center gap-3 rounded-lg border bg-primary/5 p-3">
                <Avatar className="size-9">
                  <AvatarImage
                    src={selectedUser.image ?? ''}
                    alt={selectedUser.name}
                  />
                  <AvatarFallback className="text-xs">
                    {initials(selectedUser.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">
                    {selectedUser.name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {selectedUser.email}
                  </div>
                </div>
                {selectedUser.customPlan && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">
                    JÁ TEM PLANO
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedUser(null)}
                >
                  Trocar
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Input
                  title=""
                  className={{ classNameLabel: 'hidden' }}
                  register={{
                    name: 'userSearch',
                    onChange: async (e) =>
                      setUserSearch((e.target as HTMLInputElement).value),
                    onBlur: async () => {},
                    ref: () => {},
                  }}
                  inputConfig={{
                    value: userSearch,
                    placeholder: 'Buscar usuário por nome ou e-mail (mín 2 chars)',
                  }}
                />
                {userSearch.length >= 2 && searchResults && (
                  <div className="rounded-lg border max-h-48 overflow-y-auto divide-y">
                    {searchResults.data.length === 0 ? (
                      <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                        Nenhum usuário com "{userSearch}"
                      </div>
                    ) : (
                      searchResults.data.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => handlePickUser(u)}
                          disabled={!!u.customPlan}
                          className={cn(
                            'w-full text-left px-3 py-2 hover:bg-muted/40 transition-colors flex items-center gap-2',
                            u.customPlan && 'opacity-50 cursor-not-allowed',
                          )}
                        >
                          <Avatar className="size-7">
                            <AvatarImage src={u.image ?? ''} alt={u.name} />
                            <AvatarFallback className="text-[10px]">
                              {initials(u.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">
                              {u.name}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {u.email}
                            </div>
                          </div>
                          {u.customPlan && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400">
                              tem plano
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <Input
            title="Nome do plano"
            register={{
              name: 'name',
              onChange: async (e) =>
                setName((e.target as HTMLInputElement).value),
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
              onChange: async (e) =>
                setNotes((e.target as HTMLInputElement).value),
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
            {numField('Mensal R$ (Stripe)', monthlyPrice, setMonthlyPrice, '900.00')}
            {numField(
              'Anual R$ (opcional)',
              yearlyPrice,
              setYearlyPrice,
              '9600.00',
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {numField('Max orgs', maxOrgs, setMaxOrgs)}
            {numField('Max pacientes', maxPatients, setMaxPatients)}
            {numField('Max membros', maxMembers, setMaxMembers)}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || !canSubmit}
          >
            {create.isPending ? 'Criando + Stripe…' : 'Criar plano'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
