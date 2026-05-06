import Input from '@/components/input';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { useActiveOrganization } from '@/hooks/useOrganizations';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { useZodForm } from '@/hooks/useZodForm';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import { schemaInviteMember, type SchemaInviteMember } from '@/schemas/org/invite';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Crown,
  Hourglass,
  MailPlus,
  MailX,
  MoreHorizontal,
  Search,
  Shield,
  Sparkles,
  UserMinus,
  Users,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Controller } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

interface OrgRole {
  id: string;
  role: string;
}

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function prettifyRole(slug: string): string {
  return slug
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  user: 'Membro',
};

function roleLabel(slug: string): string {
  return ROLE_LABELS[slug] ?? prettifyRole(slug);
}

// ─── Página ─────────────────────────────────────────────────────────────────

export default function MembersSettingsPage() {
  const { user } = useAuth();
  const { data: org } = useActiveOrganization();
  const features = usePlanFeatures();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // ── Cargos custom (pra o select de cargo) ──────────────────────────────
  const { data: customRoles = [] } = useQuery<OrgRole[]>({
    queryKey: ['org-roles', org?.id],
    queryFn: async () => {
      if (!org) return [];
      const res = await authClient.organization.listRoles({
        query: { organizationId: org.id },
      });
      if ('error' in res && res.error) return [];
      const data = 'data' in res ? (res.data ?? []) : [];
      return data as unknown as OrgRole[];
    },
    enabled: !!org && features.canManageRoles,
  });

  const roleOptions = useMemo(
    () => [
      { value: 'user', label: 'Membro' },
      { value: 'owner', label: 'Owner' },
      ...customRoles.map((r) => ({
        value: r.role,
        label: prettifyRole(r.role),
      })),
    ],
    [customRoles],
  );

  // ── Convites ───────────────────────────────────────────────────────────
  const { data: invitations = [] } = useQuery({
    queryKey: ['invitations', org?.id],
    queryFn: async () => {
      if (!org) return [];
      const res = await authClient.organization.listInvitations({
        query: { organizationId: org.id },
      });
      if ('error' in res && res.error) throw new Error(res.error.message);
      return 'data' in res ? (res.data ?? []) : [];
    },
    enabled: !!org,
  });

  // ── Form de convite ─────────────────────────────────────────────────────
  const {
    register,
    formProps,
    formState: { errors },
    control,
    reset,
  } = useZodForm(schemaInviteMember, {
    defaultValues: { role: 'user' },
  });

  const invite = useMutation({
    mutationFn: async (d: SchemaInviteMember) => {
      if (!org) throw new Error('Sem organização ativa');
      const res = await authClient.organization.inviteMember({
        email: d.email,
        role: d.role,
        organizationId: org.id,
      });
      if ('error' in res && res.error) throw new Error(res.error.message);
      return res;
    },
    onSuccess: () => {
      toast.success('Convite enviado.');
      qc.invalidateQueries({ queryKey: ['invitations', org?.id] });
      reset({ email: '', role: 'user' });
      setInviteOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Mutations: trocar cargo / remover / cancelar convite ────────────────
  const changeRole = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      if (!org) throw new Error('Sem organização ativa');
      const res = await authClient.organization.updateMemberRole({
        memberId,
        role: role as never,
        organizationId: org.id,
      });
      if ('error' in res && res.error) throw new Error(res.error.message);
    },
    onSuccess: () => {
      toast.success('Cargo atualizado.');
      qc.invalidateQueries({ queryKey: ['organization', 'active'] });
      qc.invalidateQueries({ queryKey: ['organization', 'byId', org?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      if (!org) throw new Error('Sem organização ativa');
      const res = await authClient.organization.removeMember({
        memberIdOrEmail: memberId,
        organizationId: org.id,
      });
      if ('error' in res && res.error) throw new Error(res.error.message);
    },
    onSuccess: () => {
      toast.success('Membro removido.');
      qc.invalidateQueries({ queryKey: ['organization', 'active'] });
      qc.invalidateQueries({ queryKey: ['organization', 'byId', org?.id] });
      setRemoveTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelInvite = useMutation({
    mutationFn: async (invitationId: string) => {
      const res = await authClient.organization.cancelInvitation({
        invitationId,
      });
      if ('error' in res && res.error) throw new Error(res.error.message);
    },
    onSuccess: () => {
      toast.success('Convite cancelado.');
      qc.invalidateQueries({ queryKey: ['invitations', org?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Render ──────────────────────────────────────────────────────────────
  if (!org) {
    return <div className="text-sm text-muted-foreground">Sem organização ativa.</div>;
  }

  const myRole = org.members?.find((m) => m.userId === user?.id)?.role ?? '';
  const canManage = myRole.includes('owner');
  const allMembers = org.members ?? [];
  const totalMembers = allMembers.length;
  const pendingInvites = invitations.filter((i) => i.status === 'pending');
  const maxMembers = features.limits.maxMembers;
  const usedSlots = totalMembers + pendingInvites.length;
  const slotsLeft = Math.max(0, maxMembers - usedSlots);
  const atLimit = slotsLeft === 0;
  const planLabel = features.planDisplay.label;

  // Filtro
  const q = search.trim().toLowerCase();
  const filteredMembers = q
    ? allMembers.filter((m) => {
        const name = m.user?.name?.toLowerCase() ?? '';
        const email = m.user?.email?.toLowerCase() ?? '';
        return name.includes(q) || email.includes(q);
      })
    : allMembers;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="rounded-xl border bg-linear-to-br from-primary/8 via-card to-card p-6 sm:p-7 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 size-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-2xl bg-primary/15 flex items-center justify-center">
              <Users className="size-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Membros</h2>
              <p className="text-sm text-muted-foreground mt-0.5 max-w-md">
                Quem tem acesso a <strong>{org.name}</strong>.
              </p>
              <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground flex-wrap">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-3.5" />
                  <strong className="text-foreground font-semibold">{usedSlots}</strong>
                  {' / '}
                  <strong className="text-foreground font-semibold">{maxMembers}</strong> no plano{' '}
                  <strong className="text-foreground font-medium">{planLabel}</strong>
                </span>
                {pendingInvites.length > 0 && (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1.5">
                      <MailPlus className="size-3.5" />
                      <strong className="text-foreground font-semibold">
                        {pendingInvites.length}
                      </strong>{' '}
                      {pendingInvites.length === 1 ? 'convite pendente' : 'convites pendentes'}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          {canManage && (
            <Button
              className="gap-2"
              onClick={() => setInviteOpen(true)}
              disabled={atLimit}
              title={
                atLimit
                  ? `Limite do plano ${planLabel} (${maxMembers}). Faça upgrade pra liberar mais.`
                  : undefined
              }
            >
              <MailPlus className="size-4" />
              {atLimit ? 'Limite atingido' : 'Convidar membro'}
            </Button>
          )}
        </div>
      </section>

      {/* ── Aviso de limite (só pra owner que pode gerenciar) ── */}
      {canManage && atLimit && !features.isTeamPlan && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-start gap-3 flex-wrap">
          <Sparkles className="size-5 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">
              Você atingiu o limite de membros do plano {planLabel}.
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {features.isFreePlan
                ? 'Pro libera você + 1 convidado (ex: secretária). Team libera até 5.'
                : 'Team libera até 5 membros e cargos personalizados.'}
            </p>
          </div>
          <Link to="/pricing">
            <Button size="sm" className="gap-2">
              Fazer upgrade
              <Sparkles className="size-3.5" />
            </Button>
          </Link>
        </div>
      )}

      {/* ── Lista ──────────────────────────────────────────── */}
      <section className="rounded-xl border bg-card overflow-hidden">
        <header className="px-6 py-4 border-b flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold">Membros ({filteredMembers.length})</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {canManage ? 'Clique no cargo para alterar.' : 'Apenas o owner pode gerenciar.'}
            </p>
          </div>
          {totalMembers > 1 && (
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none z-10" />
              <Input
                title=""
                className={{
                  classNameLabel: 'hidden',
                  classNameInput: 'pl-9 py-2',
                }}
                register={{
                  name: 'search',
                  onChange: async (e) => {
                    setSearch((e.target as HTMLInputElement).value);
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
          )}
        </header>

        {filteredMembers.length === 0 ? (
          <EmptyMembers search={q} canManage={canManage} onInvite={() => setInviteOpen(true)} />
        ) : (
          <ul className="divide-y divide-border">
            {filteredMembers.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                isMe={m.userId === user?.id}
                canManage={canManage}
                roleOptions={roleOptions}
                onChangeRole={(role) => changeRole.mutate({ memberId: m.id, role })}
                onRemove={() =>
                  setRemoveTarget({
                    id: m.id,
                    name: m.user?.name ?? m.user?.email ?? 'este membro',
                  })
                }
              />
            ))}
          </ul>
        )}
      </section>

      {/* ── Convites pendentes ─────────────────────────────── */}
      {pendingInvites.length > 0 && (
        <section className="rounded-xl border bg-card overflow-hidden">
          <header className="px-6 py-4 border-b">
            <h3 className="text-sm font-semibold">Convites pendentes</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {pendingInvites.length}{' '}
              {pendingInvites.length === 1
                ? 'convite aguardando resposta'
                : 'convites aguardando resposta'}
              .
            </p>
          </header>
          <ul className="divide-y divide-border">
            {pendingInvites.map((inv) => (
              <InvitationRow
                key={inv.id}
                invitation={inv}
                canManage={canManage}
                onCancel={() => cancelInvite.mutate(inv.id)}
                pending={cancelInvite.isPending}
              />
            ))}
          </ul>
        </section>
      )}

      {/* ── Invite dialog ──────────────────────────────────── */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar membro</DialogTitle>
            <DialogDescription>
              Enviaremos um e-mail com o link de convite. Expira em 48 horas.
            </DialogDescription>
          </DialogHeader>
          <form {...formProps((d) => invite.mutate(d))}>
            <DialogBody>
              <Input
                title="E-mail"
                register={register('email')}
                error={errors.email?.message}
                inputConfig={{ placeholder: 'pessoa@exemplo.com' }}
              />
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <Input
                    title="Cargo inicial"
                    register={{
                      name: 'role',
                      onChange: async () => {},
                      onBlur: async () => {},
                      ref: () => {},
                    }}
                    select={{
                      options: roleOptions,
                      value: field.value,
                      onChange: field.onChange,
                    }}
                  />
                )}
              />
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={invite.isPending}>
                {invite.isPending ? 'Enviando…' : 'Enviar convite'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Confirm remove ─────────────────────────────────── */}
      <Dialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover {removeTarget?.name}?</DialogTitle>
            <DialogDescription>
              A pessoa perde acesso a esta organização imediatamente. Isso não afeta a conta no
              useAcolhe — só remove o vínculo com <strong>{org.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemoveTarget(null)}
              disabled={removeMember.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => removeTarget && removeMember.mutate(removeTarget.id)}
              disabled={removeMember.isPending}
            >
              {removeMember.isPending ? 'Removendo…' : 'Remover membro'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Linha de membro ────────────────────────────────────────────────────────

type Member = NonNullable<ReturnType<typeof useActiveOrganization>['data']>['members'][number];

function MemberRow({
  member,
  isMe,
  canManage,
  roleOptions,
  onChangeRole,
  onRemove,
}: {
  member: Member;
  isMe: boolean;
  canManage: boolean;
  roleOptions: { value: string; label: string }[];
  onChangeRole: (role: string) => void;
  onRemove: () => void;
}) {
  const u = member.user;
  const name = u?.name ?? 'Membro';
  const email = u?.email ?? '';
  const isOwner = member.role.includes('owner');
  const showSelect = canManage && !isMe;

  return (
    <li className="px-6 py-3 hover:bg-muted/30 transition-colors">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Avatar className="size-10">
            <AvatarImage src={u?.image ?? ''} alt={name} />
            <AvatarFallback className="text-xs">{initials(name) || '?'}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate flex items-center gap-2">
              {name}
              {isMe && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground tracking-wide">
                  VOCÊ
                </span>
              )}
              {isOwner && <Crown className="size-3.5 text-amber-500 shrink-0" />}
            </div>
            <div className="text-xs text-muted-foreground truncate">{email}</div>
            {member.createdAt && (
              <div className="text-[11px] text-muted-foreground/80 mt-0.5">
                Entrou em{' '}
                {format(new Date(member.createdAt), "d 'de' MMM, yyyy", {
                  locale: ptBR,
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {showSelect ? (
            <div className="w-44">
              <Input
                title=""
                className={{ classNameLabel: 'hidden' }}
                register={{
                  name: `role-${member.id}`,
                  onChange: async () => {},
                  onBlur: async () => {},
                  ref: () => {},
                }}
                select={{
                  options: roleOptions,
                  value: member.role,
                  onChange: (v) => {
                    if (v !== member.role) onChangeRole(v);
                  },
                }}
              />
            </div>
          ) : (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md font-medium',
                isOwner ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
              )}
            >
              {isOwner && <Shield className="size-3" />}
              {roleLabel(member.role)}
            </span>
          )}
          {canManage && !isMe && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon" title="Mais ações">
                    <MoreHorizontal className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-destructive gap-2" onClick={onRemove}>
                  <UserMinus className="size-4" />
                  Remover membro
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </li>
  );
}

// ─── Linha de convite ──────────────────────────────────────────────────────

function InvitationRow({
  invitation,
  canManage,
  onCancel,
  pending,
}: {
  invitation: {
    id: string;
    email: string;
    role: string | null;
    expiresAt: string | Date;
  };
  canManage: boolean;
  onCancel: () => void;
  pending: boolean;
}) {
  const expiresAt = new Date(invitation.expiresAt);
  const expired = isPast(expiresAt);

  return (
    <li className="px-6 py-3 flex items-center justify-between gap-3 flex-wrap hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="size-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
          {expired ? (
            <MailX className="size-4 text-muted-foreground" />
          ) : (
            <MailPlus className="size-4 text-primary" />
          )}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{invitation.email}</div>
          <div className="text-xs text-muted-foreground truncate">
            Convidado como{' '}
            <strong className="text-foreground font-medium">
              {invitation.role ? roleLabel(invitation.role) : 'Membro'}
            </strong>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={cn(
            'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md',
            expired
              ? 'bg-destructive/10 text-destructive'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
          )}
        >
          <Hourglass className="size-3" />
          {expired
            ? 'Expirado'
            : `Expira ${formatDistanceToNow(expiresAt, { locale: ptBR, addSuffix: true })}`}
        </span>
        {canManage && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-muted-foreground hover:text-destructive"
            onClick={onCancel}
            disabled={pending}
          >
            <X className="size-3.5" />
            Cancelar
          </Button>
        )}
      </div>
    </li>
  );
}

// ─── Empty state ────────────────────────────────────────────────────────────

function EmptyMembers({
  search,
  canManage,
  onInvite,
}: {
  search: string;
  canManage: boolean;
  onInvite: () => void;
}) {
  if (search) {
    return (
      <div className="px-6 py-12 text-center">
        <div className="size-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
          <Search className="size-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">Nenhum membro encontrado</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
          Tente outro termo ou limpe a busca pra ver todos.
        </p>
      </div>
    );
  }
  return (
    <div className="px-6 py-12 text-center">
      <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
        <Users className="size-5 text-primary" />
      </div>
      <p className="text-sm font-medium">Você é o único por aqui</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
        Convide pessoas para colaborar. Cada uma recebe um e-mail com link de acesso.
      </p>
      {canManage && (
        <Button className="mt-4 gap-2" onClick={onInvite}>
          <MailPlus className="size-4" />
          Convidar membro
        </Button>
      )}
    </div>
  );
}
