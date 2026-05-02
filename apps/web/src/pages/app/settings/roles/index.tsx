import Input from '@/components/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useActiveOrganization } from '@/hooks/useOrganizations';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { authClient } from '@/lib/auth-client';
import { ACTION_LABELS, RESOURCE_LABELS, STATEMENT_KEYS } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  ChevronDown,
  Crown,
  Eraser,
  Eye,
  EyeOff,
  Lock,
  Pencil,
  Pen,
  Plus,
  Settings as SettingsIcon,
  Shield,
  ShieldCheck,
  Stethoscope,
  Trash2,
  TriangleAlert,
  User,
  Users,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

type Permission = Record<string, string[]>;

interface OrgRole {
  id: string;
  role: string;
  permission: Permission;
}

// ─── Agrupamento por domínio ────────────────────────────────────────────────

type Group = {
  id: string;
  title: string;
  description: string;
  icon: typeof Briefcase;
  resources: string[];
};

const GROUPS: Group[] = [
  {
    id: 'atendimento',
    title: 'Atendimento',
    description: 'Tudo que toca o cuidado do paciente.',
    icon: Stethoscope,
    resources: ['paciente', 'sessao', 'prontuario'],
  },
  {
    id: 'operacional',
    title: 'Operacional',
    description: 'Agenda e financeiro do dia a dia.',
    icon: Briefcase,
    resources: ['agenda', 'financeiro'],
  },
  {
    id: 'administracao',
    title: 'Administração',
    description: 'Gestão da organização — restrinja a poucos.',
    icon: SettingsIcon,
    resources: ['organization', 'member', 'invitation', 'ac', 'audit'],
  },
];

const SENSITIVE_RESOURCES = new Set(['prontuario', 'audit']);

// ─── Níveis de acesso por recurso ───────────────────────────────────────────
// Em vez de checkboxes por ação, oferecemos níveis semânticos que mapeiam pra
// combinações de ações. Cobre 95% dos casos com UX muito mais simples.

type Level = {
  /** chave estável usada como `value` do <select> */
  id: string;
  label: string;
  description: string;
  actions: readonly string[];
  /** Tier visual: 0=nenhum, 1=leitura, 2=edição, 3=total/destrutivo */
  tier: 0 | 1 | 2 | 3;
};

function getLevelsFor(actions: readonly string[]): Level[] {
  const has = (a: string) => actions.includes(a);
  const set = new Set(actions);

  // CRUD completo: paciente, sessao, agenda, ac
  if (has('create') && has('read') && has('update') && has('delete') && set.size === 4) {
    return [
      {
        id: 'none',
        label: 'Sem acesso',
        description: 'Não pode ver nem editar.',
        actions: [],
        tier: 0,
      },
      {
        id: 'read',
        label: 'Apenas visualizar',
        description: 'Pode ver, mas não muda nada.',
        actions: ['read'],
        tier: 1,
      },
      {
        id: 'edit',
        label: 'Edição (sem excluir)',
        description: 'Pode criar e editar, sem excluir.',
        actions: ['read', 'create', 'update'],
        tier: 2,
      },
      {
        id: 'all',
        label: 'Acesso total',
        description: 'Inclui excluir registros.',
        actions: ['read', 'create', 'update', 'delete'],
        tier: 3,
      },
    ];
  }

  // read + update: prontuario, financeiro
  if (has('read') && has('update') && set.size === 2) {
    return [
      { id: 'none', label: 'Sem acesso', description: 'Não pode acessar.', actions: [], tier: 0 },
      {
        id: 'read',
        label: 'Apenas visualizar',
        description: 'Pode ver, mas não edita.',
        actions: ['read'],
        tier: 1,
      },
      {
        id: 'edit',
        label: 'Visualizar e editar',
        description: 'Pode ver e editar.',
        actions: ['read', 'update'],
        tier: 2,
      },
    ];
  }

  // só read: audit
  if (has('read') && set.size === 1) {
    return [
      {
        id: 'none',
        label: 'Sem acesso',
        description: 'Não pode visualizar.',
        actions: [],
        tier: 0,
      },
      {
        id: 'read',
        label: 'Pode visualizar',
        description: 'Acesso de leitura.',
        actions: ['read'],
        tier: 1,
      },
    ];
  }

  // update + delete: organization
  if (has('update') && has('delete') && set.size === 2) {
    return [
      {
        id: 'none',
        label: 'Sem acesso',
        description: 'Não pode editar a organização.',
        actions: [],
        tier: 0,
      },
      {
        id: 'edit',
        label: 'Pode editar',
        description: 'Editar nome, slug, configurações.',
        actions: ['update'],
        tier: 2,
      },
      {
        id: 'all',
        label: 'Editar e excluir',
        description: 'Inclui excluir a organização.',
        actions: ['update', 'delete'],
        tier: 3,
      },
    ];
  }

  // create + update + delete: member
  if (has('create') && has('update') && has('delete') && set.size === 3) {
    return [
      {
        id: 'none',
        label: 'Sem acesso',
        description: 'Não pode mexer em membros.',
        actions: [],
        tier: 0,
      },
      {
        id: 'invite',
        label: 'Pode convidar',
        description: 'Apenas adicionar novos membros.',
        actions: ['create'],
        tier: 2,
      },
      {
        id: 'all',
        label: 'Gerenciar membros',
        description: 'Adicionar, editar e remover.',
        actions: ['create', 'update', 'delete'],
        tier: 3,
      },
    ];
  }

  // create + cancel: invitation
  if (has('create') && has('cancel') && set.size === 2) {
    return [
      {
        id: 'none',
        label: 'Sem acesso',
        description: 'Não pode lidar com convites.',
        actions: [],
        tier: 0,
      },
      {
        id: 'all',
        label: 'Gerenciar convites',
        description: 'Criar e cancelar convites.',
        actions: ['create', 'cancel'],
        tier: 2,
      },
    ];
  }

  // fallback: 1 nível por ação
  return [
    { id: 'none', label: 'Sem acesso', description: '—', actions: [], tier: 0 },
    {
      id: 'all',
      label: 'Acesso total',
      description: actions.map((a) => ACTION_LABELS[a] ?? a).join(', '),
      actions: [...actions],
      tier: 3,
    },
  ];
}

/** Acha qual nível corresponde ao array atual de actions; cai em "none" se nada bater. */
function levelIdFor(levels: Level[], current: readonly string[]): string {
  const sorted = [...current].sort().join(',');
  for (const l of levels) {
    if ([...l.actions].sort().join(',') === sorted) return l.id;
  }
  return 'none';
}

// ─── Presets ────────────────────────────────────────────────────────────────

type Preset = {
  id: string;
  label: string;
  description: string;
  icon: typeof Stethoscope;
  permission: Permission;
};

const PRESETS: Preset[] = [
  {
    id: 'secretaria',
    label: 'Recepção / Secretaria',
    description: 'Cuida de agenda e cadastro. Sem prontuário.',
    icon: Briefcase,
    permission: {
      paciente: ['read', 'create', 'update'],
      agenda: ['read', 'create', 'update', 'delete'],
      financeiro: ['read'],
    },
  },
  {
    id: 'psicologo_jr',
    label: 'Psicólogo Júnior',
    description: 'Atende pacientes. Sem gestão administrativa.',
    icon: Stethoscope,
    permission: {
      paciente: ['read', 'create', 'update'],
      sessao: ['read', 'create', 'update'],
      prontuario: ['read', 'update'],
      agenda: ['read', 'create', 'update'],
      financeiro: ['read'],
    },
  },
  {
    id: 'vazio',
    label: 'Limpar tudo',
    description: 'Comece do zero.',
    icon: Eraser,
    permission: {},
  },
];

// ─── Permissões padrão (espelho do backend) ─────────────────────────────────

const DEFAULT_OWNER_PERMS: Permission = Object.fromEntries(
  STATEMENT_KEYS.map((s) => [s.resource, [...s.actions]]),
);
const DEFAULT_USER_PERMS: Permission = { ac: ['read'] };

// ─── Helpers ────────────────────────────────────────────────────────────────

function parsePermission(raw: Permission | string | undefined | null): Permission {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Permission;
    } catch {
      return {};
    }
  }
  return raw;
}

function countTotalPermissions(perm: Permission): number {
  return Object.values(perm).reduce((a, b) => a + b.length, 0);
}

/** Resumo por nível para a listagem. */
function summarizeRole(perm: Permission): string {
  const items: string[] = [];
  for (const s of STATEMENT_KEYS) {
    const actions = perm[s.resource] ?? [];
    if (actions.length === 0) continue;
    const levels = getLevelsFor(s.actions);
    const id = levelIdFor(levels, actions);
    const level = levels.find((l) => l.id === id);
    const resourceLabel = RESOURCE_LABELS[s.resource] ?? s.resource;
    if (level && level.id !== 'none') {
      items.push(`${resourceLabel}: ${level.label.toLowerCase()}`);
    }
  }
  if (items.length === 0) return 'Sem permissões';
  if (items.length <= 2) return items.join(' · ');
  return `${items.slice(0, 2).join(' · ')} · +${items.length - 2}`;
}

// ─── Página ─────────────────────────────────────────────────────────────────

export default function RolesSettingsPage() {
  const features = usePlanFeatures();
  const { data: org } = useActiveOrganization();
  const qc = useQueryClient();

  const { data: roles = [], isLoading } = useQuery<OrgRole[]>({
    queryKey: ['org-roles', org?.id],
    queryFn: async () => {
      if (!org) return [];
      const res = await authClient.organization.listRoles({
        query: { organizationId: org.id },
      });
      if ('error' in res && res.error) throw new Error(res.error.message);
      const data = 'data' in res ? (res.data ?? []) : [];
      return data as unknown as OrgRole[];
    },
    enabled: !!org && features.canManageRoles,
  });

  const [editing, setEditing] = useState<OrgRole | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OrgRole | null>(null);

  // Conta membros por role para mostrar na lista
  const memberCountByRole = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of org?.members ?? []) {
      counts[m.role] = (counts[m.role] ?? 0) + 1;
    }
    return counts;
  }, [org?.members]);

  const remove = useMutation({
    mutationFn: async (role: OrgRole) => {
      if (!org) throw new Error('Sem organização ativa');
      const res = await authClient.organization.deleteRole({
        roleName: role.role,
        organizationId: org.id,
      });
      if ('error' in res && res.error) throw new Error(res.error.message);
    },
    onSuccess: () => {
      toast.success('Cargo removido.');
      qc.invalidateQueries({ queryKey: ['org-roles', org?.id] });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!features.canManageRoles) return <UpsellPanel />;

  const totalMembers = org?.members?.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="rounded-xl border bg-linear-to-br from-primary/8 via-card to-card p-6 sm:p-7 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 size-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-2xl bg-primary/15 flex items-center justify-center">
              <ShieldCheck className="size-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Cargos</h2>
              <p className="text-sm text-muted-foreground mt-0.5 max-w-md">
                Defina o que cada pessoa do seu time pode fazer dentro desta organização.
              </p>
              <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-3.5" />
                  <strong className="text-foreground font-semibold">{totalMembers}</strong>{' '}
                  {totalMembers === 1 ? 'membro' : 'membros'} no total
                </span>
                <span>·</span>
                <span className="inline-flex items-center gap-1.5">
                  <Shield className="size-3.5" />
                  <strong className="text-foreground font-semibold">{roles.length}</strong>{' '}
                  {roles.length === 1 ? 'cargo custom' : 'cargos custom'}
                </span>
              </div>
            </div>
          </div>
          <Button className="gap-2" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Novo cargo
          </Button>
        </div>
      </section>

      {/* ── Cargos do sistema ───────────────────────────────── */}
      <section className="rounded-xl border bg-card overflow-hidden">
        <header className="px-6 py-4 border-b">
          <h3 className="text-sm font-semibold">Cargos do sistema</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Vêm com a organização e não podem ser removidos.
          </p>
        </header>
        <DefaultRoleRow
          icon={Crown}
          name="Owner"
          slug="owner"
          description="Acesso total. Faz tudo que precisar — gerenciar org, equipe, faturas e dados."
          permission={DEFAULT_OWNER_PERMS}
          memberCount={memberCountByRole['owner'] ?? 0}
        />
        <DefaultRoleRow
          icon={User}
          name="Membro padrão"
          slug="user"
          description="Apenas leitura básica. É o cargo atribuído automaticamente em novos convites."
          permission={DEFAULT_USER_PERMS}
          memberCount={memberCountByRole['user'] ?? 0}
        />
      </section>

      {/* ── Cargos custom ───────────────────────────────────── */}
      <section className="rounded-xl border bg-card overflow-hidden">
        <header className="px-6 py-4 border-b">
          <h3 className="text-sm font-semibold">Cargos personalizados</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {roles.length === 0
              ? 'Nenhum cargo personalizado ainda.'
              : `${roles.length} ${roles.length === 1 ? 'cargo criado' : 'cargos criados'}.`}
          </p>
        </header>

        {isLoading && (
          <div className="px-6 py-8 text-sm text-muted-foreground text-center">
            Carregando cargos…
          </div>
        )}

        {!isLoading && roles.length === 0 && (
          <div className="px-6 py-12 text-center">
            <div className="size-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <Shield className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Nenhum cargo criado</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              Crie cargos para dar acesso preciso aos membros — secretaria, psicólogo júnior, etc.
            </p>
            <Button className="mt-4 gap-2" onClick={() => setCreating(true)}>
              <Plus className="size-4" /> Criar primeiro cargo
            </Button>
          </div>
        )}

        {roles.length > 0 && (
          <ul>
            {roles.map((r) => (
              <CustomRoleRow
                key={r.id}
                role={r}
                memberCount={memberCountByRole[r.role] ?? 0}
                onEdit={() => setEditing(r)}
                onDelete={() => setDeleteTarget(r)}
              />
            ))}
          </ul>
        )}
      </section>

      {(creating || editing) && (
        <RoleDialog
          role={editing}
          orgId={org?.id ?? null}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['org-roles', org?.id] });
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir cargo {deleteTarget?.role}?</DialogTitle>
            <DialogDescription>
              Membros que tinham este cargo voltam ao acesso de membro padrão. Esta ação não pode
              ser desfeita.
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
              onClick={() => deleteTarget && remove.mutate(deleteTarget)}
              disabled={remove.isPending}
            >
              {remove.isPending ? 'Excluindo...' : 'Excluir cargo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
      <h2 className="text-lg font-semibold">Cargos personalizados estão no plano Team</h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
        Defina exatamente o que cada membro da sua equipe pode ver e editar: secretaria sem acesso a
        prontuário, financeiro só pra você, etc.
      </p>
      <Link to="/pricing">
        <Button className="mt-5">Ver plano Team</Button>
      </Link>
    </section>
  );
}

// ─── Linhas da listagem ─────────────────────────────────────────────────────

function DefaultRoleRow({
  icon: Icon,
  name,
  slug,
  description,
  permission,
  memberCount,
}: {
  icon: typeof Crown;
  name: string;
  slug: string;
  description: string;
  permission: Permission;
  memberCount: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b last:border-b-0">
      <div className="flex items-center justify-between gap-4 px-6 py-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
            <Icon className="size-5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold flex items-center gap-2 flex-wrap">
              {name}
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wide">
                Padrão
              </span>
              <code className="text-[10px] text-muted-foreground/70 font-mono">{slug}</code>
            </div>
            <div className="text-xs text-muted-foreground truncate max-w-md mt-0.5">
              {description}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="size-3.5" />
            {memberCount} {memberCount === 1 ? 'pessoa' : 'pessoas'}
          </span>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 cursor-pointer"
          >
            {open ? 'Ocultar' : 'Ver permissões'}
            <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
          </button>
        </div>
      </div>
      {open && (
        <div className="px-6 pb-5">
          <PermissionMatrix permission={permission} />
        </div>
      )}
    </div>
  );
}

function CustomRoleRow({
  role,
  memberCount,
  onEdit,
  onDelete,
}: {
  role: OrgRole;
  memberCount: number;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const perm = parsePermission(role.permission);
  const [open, setOpen] = useState(false);
  const total = countTotalPermissions(perm);
  const summary = summarizeRole(perm);

  return (
    <li className="border-b last:border-b-0">
      <div className="flex items-center justify-between gap-3 px-6 py-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Shield className="size-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">{role.role}</div>
            <div className="text-xs text-muted-foreground truncate mt-0.5">{summary}</div>
            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Users className="size-3" />
                {memberCount} {memberCount === 1 ? 'pessoa' : 'pessoas'}
              </span>
              <span>·</span>
              <span>
                {total} {total === 1 ? 'permissão' : 'permissões'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setOpen((v) => !v)}>
            {open ? 'Ocultar' : 'Ver'}
            <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
          </Button>
          <Button variant="ghost" size="icon" onClick={onEdit} title="Editar">
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            title="Excluir"
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      {open && (
        <div className="px-6 pb-5">
          <PermissionMatrix permission={perm} />
        </div>
      )}
    </li>
  );
}

// ─── Read-only matrix (compacta) ────────────────────────────────────────────

const TIER_STYLES: Record<number, string> = {
  0: 'bg-muted/50 text-muted-foreground',
  1: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  2: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  3: 'bg-primary/15 text-primary',
};

const TIER_ICONS: Record<number, typeof Eye> = {
  0: EyeOff,
  1: Eye,
  2: Pen,
  3: Zap,
};

function PermissionMatrix({ permission }: { permission: Permission }) {
  return (
    <div className="rounded-lg border bg-muted/20 divide-y">
      {GROUPS.map((g) => {
        const items = g.resources
          .map((r) => {
            const actions = permission[r] ?? [];
            const stmt = STATEMENT_KEYS.find((s) => s.resource === r);
            if (!stmt) return null;
            const levels = getLevelsFor(stmt.actions);
            const id = levelIdFor(levels, actions);
            const level = levels.find((l) => l.id === id);
            return { resource: r, level };
          })
          .filter((i): i is { resource: string; level: Level } => !!i?.level);

        const visible = items.filter((i) => i.level.id !== 'none');
        if (visible.length === 0) return null;

        const Icon = g.icon;
        return (
          <div key={g.id} className="px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="size-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {g.title}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {visible.map(({ resource, level }) => {
                const TierIcon = TIER_ICONS[level.tier];
                return (
                  <div key={resource} className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-medium inline-flex items-center gap-1.5">
                      {RESOURCE_LABELS[resource] ?? resource}
                      {SENSITIVE_RESOURCES.has(resource) && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
                          <TriangleAlert className="size-2.5" /> LGPD
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium',
                        TIER_STYLES[level.tier],
                      )}
                    >
                      <TierIcon className="size-3" />
                      {level.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {countTotalPermissions(permission) === 0 && (
        <div className="px-4 py-6 text-xs text-muted-foreground text-center">Sem permissões.</div>
      )}
    </div>
  );
}

// ─── Modal: criar / editar cargo ────────────────────────────────────────────

function RoleDialog({
  role,
  orgId,
  onClose,
  onSaved,
}: {
  role: OrgRole | null;
  orgId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!role;
  const [name, setName] = useState(role?.role ?? '');
  const [perm, setPerm] = useState<Permission>(() =>
    role ? parsePermission(role.permission) : {},
  );

  useEffect(() => {
    setName(role?.role ?? '');
    setPerm(role ? parsePermission(role.permission) : {});
  }, [role]);

  const setLevel = (resource: string, levels: Level[], levelId: string) => {
    const level = levels.find((l) => l.id === levelId);
    if (!level) return;
    setPerm((p) => ({ ...p, [resource]: [...level.actions] }));
  };

  const applyPreset = (preset: Preset) => setPerm(preset.permission);

  const totalSelected = useMemo(() => countTotalPermissions(perm), [perm]);

  const save = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error('Sem organização ativa');
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Dê um nome para o cargo');
      if (!editing && !/^[a-zA-Z0-9_ -]+$/.test(trimmed)) {
        throw new Error('Use letras, números, espaços, _ e -');
      }
      const slug = trimmed.toLowerCase().replace(/\s+/g, '_');
      const cleanPerm: Permission = {};
      for (const [k, v] of Object.entries(perm)) {
        if (v.length > 0) cleanPerm[k] = v;
      }

      if (role) {
        const res = await authClient.organization.updateRole({
          roleName: role.role,
          organizationId: orgId,
          data: { permission: cleanPerm },
        });
        if ('error' in res && res.error) throw new Error(res.error.message);
      } else {
        const res = await authClient.organization.createRole({
          role: slug,
          organizationId: orgId,
          permission: cleanPerm,
        });
        if ('error' in res && res.error) throw new Error(res.error.message);
      }
    },
    onSuccess: () => {
      toast.success(editing ? 'Cargo atualizado.' : 'Cargo criado.');
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl p-0 gap-0">
        <DialogHeader className="px-6 py-5 border-b">
          <DialogTitle>{editing ? `Editar cargo` : 'Criar cargo personalizado'}</DialogTitle>
          <DialogDescription>
            Pra cada área, escolha o nível de acesso que esse cargo terá.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 flex flex-col gap-6 max-h-[65dvh] overflow-y-auto">
          {/* Nome */}
          <div className="flex flex-col gap-1.5">
            <Input
              title="Nome do cargo"
              register={{
                name: 'name',
                onChange: async (e) => {
                  setName((e.target as HTMLInputElement).value);
                },
                onBlur: async () => {},
                ref: () => {},
              }}
              inputConfig={{
                value: name,
                placeholder: 'ex: Secretaria, Psicólogo Júnior',
                disabled: editing,
              }}
            />
            <span className="text-xs text-muted-foreground">
              {editing
                ? 'Nome não pode ser alterado depois de criado.'
                : 'Aparece no convite e no perfil dos membros.'}
            </span>
          </div>

          {/* Presets — só na criação */}
          {!editing && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Comece com um modelo
              </label>
              <div className="grid sm:grid-cols-3 gap-2">
                {PRESETS.map((p) => {
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyPreset(p)}
                      className="text-left rounded-lg border bg-card p-3 hover:border-primary/40 hover:bg-muted/30 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="size-4 text-primary" />
                        <span className="text-sm font-medium">{p.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-snug">
                        {p.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Acessos por área */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Acessos por área
                </label>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Pra cada recurso, escolha um nível. Detalhes aparecem ao selecionar.
                </div>
              </div>
              <span className="text-xs text-muted-foreground">
                <strong className="text-foreground font-semibold">{totalSelected}</strong> ações
                concedidas
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {GROUPS.map((g) => (
                <ResourceGroup key={g.id} group={g} permission={perm} onLevelChange={setLevel} />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Salvando...' : editing ? 'Salvar alterações' : 'Criar cargo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Group + resource (editor com select) ───────────────────────────────────

function ResourceGroup({
  group,
  permission,
  onLevelChange,
}: {
  group: Group;
  permission: Permission;
  onLevelChange: (resource: string, levels: Level[], levelId: string) => void;
}) {
  const Icon = group.icon;
  const resources = STATEMENT_KEYS.filter((s) => group.resources.includes(s.resource));
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <header className="px-4 py-3 border-b bg-muted/20 flex items-center gap-2">
        <div className="size-7 rounded-md bg-primary/10 flex items-center justify-center">
          <Icon className="size-3.5 text-primary" />
        </div>
        <div>
          <div className="text-sm font-semibold leading-tight">{group.title}</div>
          <div className="text-xs text-muted-foreground">{group.description}</div>
        </div>
      </header>
      <div className="divide-y">
        {resources.map((s) => (
          <ResourceSelectRow
            key={s.resource}
            resource={s.resource}
            actions={s.actions}
            current={permission[s.resource] ?? []}
            onChange={(levelId) => {
              const levels = getLevelsFor(s.actions);
              onLevelChange(s.resource, levels, levelId);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ResourceSelectRow({
  resource,
  actions,
  current,
  onChange,
}: {
  resource: string;
  actions: readonly string[];
  current: readonly string[];
  onChange: (levelId: string) => void;
}) {
  const levels = getLevelsFor(actions);
  const selectedId = levelIdFor(levels, current);
  const selected = levels.find((l) => l.id === selectedId) ?? levels[0];
  const isSensitive = SENSITIVE_RESOURCES.has(resource);
  const TierIcon = TIER_ICONS[selected.tier];

  return (
    <div className="px-4 py-3 flex items-start justify-between gap-4 flex-wrap">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{RESOURCE_LABELS[resource] ?? resource}</span>
          {isSensitive && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <TriangleAlert className="size-3" /> LGPD
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{selected.description}</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span
          className={cn(
            'inline-flex items-center justify-center size-9 rounded-md',
            TIER_STYLES[selected.tier],
          )}
          aria-hidden
        >
          <TierIcon className="size-4" />
        </span>
        <div className="w-56">
          <Input
            title=""
            className={{ classNameLabel: 'hidden' }}
            register={{
              name: resource,
              onChange: async () => {},
              onBlur: async () => {},
              ref: () => {},
            }}
            select={{
              options: levels.map((l) => ({ value: l.id, label: l.label })),
              value: selectedId,
              onChange: (id) => onChange(id),
              notFilter: true,
            }}
          />
        </div>
      </div>
    </div>
  );
}
