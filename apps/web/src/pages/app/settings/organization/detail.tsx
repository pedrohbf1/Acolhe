import Input from "@/components/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import {
  useActiveOrganization,
  useOrganization,
  useOrganizations,
} from "@/hooks/useOrganizations";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { useSwitchOrganization } from "@/hooks/useSwitchOrganization";
import { useZodForm } from "@/hooks/useZodForm";
import { authClient } from "@/lib/auth-client";
import {
  schemaCreateOrganization,
  type SchemaCreateOrganization,
} from "@/schemas/org/create";
import {
  schemaInviteMember,
  type SchemaInviteMember,
} from "@/schemas/org/invite";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Check,
  Crown,
  Loader2,
  MailPlus,
  MoreHorizontal,
  Pencil,
  Sparkles,
  Trash2,
  UserMinus,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Controller } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDate(d?: string | Date | null) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function OrganizationDetailPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: org, isLoading: loadingOrg } = useOrganization(orgId);
  const { data: active } = useActiveOrganization();
  const { data: orgs = [], isLoading: loadingList } = useOrganizations();
  const features = usePlanFeatures();
  // planDisplay já considera custom plan pago — usar `useActivePlan` direto
  // ignoraria o custom plan e mostraria "free" mesmo após pagamento.
  const planDisplay = features.planDisplay;
  const qc = useQueryClient();
  const switchOrg = useSwitchOrganization();

  const isActive = !!org && active?.id === org.id;

  // Se a org da URL não existe na lista do usuário, manda de volta
  useEffect(() => {
    if (loadingList || !orgId) return;
    if (orgs.length === 0) return;
    const exists = orgs.some((o) => o.id === orgId);
    if (!exists) {
      toast.error("Organização não encontrada.");
      navigate("/configuracoes/organizacao", { replace: true });
    }
  }, [orgId, orgs, loadingList, navigate]);

  // ── Edit ─────────────────────────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const {
    register: registerEdit,
    formProps: formPropsEdit,
    formState: { errors: errorsEdit },
    reset: resetEdit,
  } = useZodForm(schemaCreateOrganization);

  useEffect(() => {
    if (org) resetEdit({ name: org.name, slug: org.slug });
  }, [org, resetEdit]);

  const update = useMutation({
    mutationFn: async (d: SchemaCreateOrganization) => {
      if (!org) throw new Error("Organização não encontrada");
      const res = await authClient.organization.update({
        organizationId: org.id,
        data: { name: d.name, slug: d.slug },
      });
      if ("error" in res && res.error) throw new Error(res.error.message);
      return res;
    },
    onSuccess: () => {
      toast.success("Organização atualizada.");
      qc.invalidateQueries({ queryKey: ["organization", "byId", orgId] });
      qc.invalidateQueries({ queryKey: ["organization", "active"] });
      qc.invalidateQueries({ queryKey: ["organizations"] });
      setEditOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Delete ───────────────────────────────────────────────────────────────
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const remove = useMutation({
    mutationFn: async () => {
      if (!org) throw new Error("Organização não encontrada");
      const res = await authClient.organization.delete({
        organizationId: org.id,
      });
      if ("error" in res && res.error) throw new Error(res.error.message);
    },
    onSuccess: () => {
      toast.success("Organização excluída.");
      qc.invalidateQueries({ queryKey: ["organizations"] });
      qc.invalidateQueries({ queryKey: ["organization", "active"] });
      qc.invalidateQueries({ queryKey: ["organization", "byId", orgId] });
      qc.invalidateQueries({ queryKey: ["session"] });
      setDeleteOpen(false);
      window.location.href = "/configuracoes/organizacao";
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Invite ───────────────────────────────────────────────────────────────
  const [inviteOpen, setInviteOpen] = useState(false);
  const {
    register: registerInvite,
    formProps: formPropsInvite,
    formState: { errors: errorsInvite },
    control: controlInvite,
    reset: resetInvite,
  } = useZodForm(schemaInviteMember, { defaultValues: { role: "user" } });

  const invite = useMutation({
    mutationFn: async (d: SchemaInviteMember) => {
      if (!org) throw new Error("Organização não encontrada");
      const res = await authClient.organization.inviteMember({
        email: d.email,
        role: d.role,
        organizationId: org.id,
      });
      if ("error" in res && res.error) throw new Error(res.error.message);
      return res;
    },
    onSuccess: () => {
      toast.success("Convite enviado.");
      qc.invalidateQueries({ queryKey: ["invitations", org?.id] });
      resetInvite({ email: "", role: "user" });
      setInviteOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Member actions ───────────────────────────────────────────────────────
  const removeMember = useMutation({
    mutationFn: async (memberIdOrEmail: string) => {
      if (!org) throw new Error("Organização não encontrada");
      const res = await authClient.organization.removeMember({
        memberIdOrEmail,
        organizationId: org.id,
      });
      if ("error" in res && res.error) throw new Error(res.error.message);
    },
    onSuccess: () => {
      toast.success("Membro removido.");
      qc.invalidateQueries({ queryKey: ["organization", "byId", orgId] });
      qc.invalidateQueries({ queryKey: ["organization", "active"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Invitations list ─────────────────────────────────────────────────────
  const { data: invitations = [] } = useQuery({
    queryKey: ["invitations", org?.id],
    queryFn: async () => {
      if (!org) return [];
      const res = await authClient.organization.listInvitations({
        query: { organizationId: org.id },
      });
      if ("error" in res && res.error) throw new Error(res.error.message);
      return "data" in res ? (res.data ?? []) : [];
    },
    enabled: !!org,
  });

  const cancelInvite = useMutation({
    mutationFn: async (invitationId: string) => {
      const res = await authClient.organization.cancelInvitation({
        invitationId,
      });
      if ("error" in res && res.error) throw new Error(res.error.message);
    },
    onSuccess: () => {
      toast.success("Convite cancelado.");
      qc.invalidateQueries({ queryKey: ["invitations", org?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Loading / mismatch ───────────────────────────────────────────────────
  if (loadingOrg || loadingList || !org) {
    return (
      <div className="flex flex-col gap-6">
        <button
          type="button"
          onClick={() => navigate("/configuracoes/organizacao")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit cursor-pointer"
        >
          <ArrowLeft className="size-4" /> Voltar
        </button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando organização…
        </div>
      </div>
    );
  }

  const myMember = org.members?.find((m) => m.userId === user?.id);
  const myRole = myMember?.role ?? "user";
  const isOwner = myRole.includes("owner");
  const memberCount = org.members?.length ?? 0;
  const pendingInvites = invitations.filter((i) => i.status === "pending");
  const canManage = features.canManageMembers && isOwner;
  const canDelete = features.isTeamPlan && isOwner;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Voltar ──────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => navigate("/configuracoes/organizacao")}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit cursor-pointer"
      >
        <ArrowLeft className="size-4" /> Voltar para organizações
      </button>

      {/* ── Banner: org não-ativa ───────────────────────────── */}
      {!isActive && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-3 flex-wrap">
          <div className="size-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
            <Zap className="size-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              Você está vendo uma organização que não é a ativa.
            </p>
            <p className="text-xs text-muted-foreground">
              Ative-a para que dashboard, agenda e cobrança usem este contexto.
            </p>
          </div>
          <Button
            className="gap-2"
            onClick={() => switchOrg.mutate(org.id)}
            disabled={switchOrg.isPending}
          >
            <Zap className="size-4" />
            {switchOrg.isPending ? "Ativando…" : "Definir como ativa"}
          </Button>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────── */}
      <section className="rounded-xl border bg-card p-6">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="size-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
            {org.logo ? (
              <img src={org.logo} alt="" className="size-14 object-cover" />
            ) : (
              <Building2 className="size-7 text-primary" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold truncate">{org.name}</h1>
              {isActive && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-primary/15 text-primary tracking-wide">
                  <Check className="size-3" /> ATIVA
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">/{org.slug}</p>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground capitalize">
                {isOwner && <Crown className="size-3.5 text-amber-500" />}
                {myRole}
              </span>
              {isActive && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground">
                  <Sparkles className="size-3.5 text-primary" />
                  Plano {planDisplay.label}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isOwner && (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="size-4" />
                Editar
              </Button>
            )}
            {canDelete && (
              <Button
                variant="destructive"
                className="gap-2"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-4" />
                Excluir
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* ── Stats ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          icon={<Users className="size-5 text-primary" />}
          label="Membros"
          value={`${memberCount} ${memberCount === 1 ? "pessoa" : "pessoas"}`}
        />
        <StatCard
          icon={<MailPlus className="size-5 text-primary" />}
          label="Convites pendentes"
          value={`${pendingInvites.length}`}
        />
        <StatCard
          icon={<CalendarDays className="size-5 text-primary" />}
          label="Criada em"
          value={formatDate(org.createdAt)}
        />
      </div>

      {/* ── Membros ─────────────────────────────────────────── */}
      <section className="rounded-xl border bg-card p-6">
        <header className="flex items-start justify-between gap-4 mb-4 flex-wrap">
          <div>
            <h2 className="text-base font-semibold">Membros</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Pessoas que têm acesso a esta organização.
            </p>
          </div>
          {canManage && (
            <Button className="gap-2" onClick={() => setInviteOpen(true)}>
              <MailPlus className="size-4" />
              Convidar membro
            </Button>
          )}
        </header>

        <ul className="divide-y divide-border">
          {(org.members ?? []).map((m) => {
            const u = m.user;
            const name = u?.name ?? "Membro";
            const email = u?.email ?? "";
            const isMe = u?.id === user?.id;
            return (
              <li
                key={m.id}
                className="flex items-center justify-between py-3 gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="size-9">
                    <AvatarImage src={u?.image ?? ""} alt={name} />
                    <AvatarFallback className="text-xs">
                      {initials(name) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {name}
                      {isMe && (
                        <span className="ml-2 text-xs text-muted-foreground font-normal">
                          (você)
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {email}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground capitalize">
                    {m.role}
                  </span>
                  {canManage && !isMe && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive gap-2"
                          onClick={() => removeMember.mutate(m.id)}
                        >
                          <UserMinus className="size-4" />
                          Remover membro
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── Convites pendentes ──────────────────────────────── */}
      {pendingInvites.length > 0 && (
        <section className="rounded-xl border bg-card p-6">
          <header className="mb-4">
            <h2 className="text-base font-semibold">Convites pendentes</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {pendingInvites.length}{" "}
              {pendingInvites.length === 1
                ? "convite aguardando resposta"
                : "convites aguardando resposta"}
              .
            </p>
          </header>
          <ul className="divide-y divide-border">
            {pendingInvites.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between py-3 gap-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {inv.email}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Convidado como {inv.role ?? "membro"}
                  </div>
                </div>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-muted-foreground hover:text-destructive"
                    onClick={() => cancelInvite.mutate(inv.id)}
                    disabled={cancelInvite.isPending}
                  >
                    <X className="size-3.5" />
                    Cancelar
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Edit dialog ─────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar organização</DialogTitle>
            <DialogDescription>
              Atualize o nome e o identificador desta organização.
            </DialogDescription>
          </DialogHeader>
          <form {...formPropsEdit((d) => update.mutate(d))}>
            <DialogBody>
              <Input
                title="Nome"
                register={registerEdit("name")}
                error={errorsEdit.name?.message}
              />
              <Input
                title="Identificador (URL)"
                register={registerEdit("slug")}
                error={errorsEdit.slug?.message}
                inputSubmit
              />
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                disabled={update.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Invite dialog ───────────────────────────────────── */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar membro</DialogTitle>
            <DialogDescription>
              Enviaremos um e-mail com o link de convite.
            </DialogDescription>
          </DialogHeader>
          <form {...formPropsInvite((d) => invite.mutate(d))}>
            <DialogBody>
              <Input
                title="E-mail"
                register={registerInvite("email")}
                error={errorsInvite.email?.message}
              />
              <Controller
                control={controlInvite}
                name="role"
                render={({ field }) => (
                  <Input
                    title="Cargo"
                    register={{
                      name: "role",
                      onChange: async () => {},
                      onBlur: async () => {},
                      ref: () => {},
                    }}
                    select={{
                      options: [
                        { value: "user", label: "Membro" },
                        { value: "owner", label: "Owner" },
                      ],
                      value: field.value,
                      onChange: field.onChange,
                    }}
                  />
                )}
              />
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setInviteOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={invite.isPending}>
                {invite.isPending ? "Enviando..." : "Enviar convite"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete dialog ───────────────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir {org.name}?</DialogTitle>
            <DialogDescription>
              Esta ação é irreversível. Todos os dados, membros e convites serão
              removidos. Para confirmar, digite <strong>{org.slug}</strong>{" "}
              abaixo.
            </DialogDescription>
          </DialogHeader>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={org.slug}
            className="w-full border border-border rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-destructive focus:border-destructive"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={remove.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={confirmText !== org.slug || remove.isPending}
              onClick={() => remove.mutate()}
            >
              {remove.isPending ? "Excluindo..." : "Excluir definitivamente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── StatCard ────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
      <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold truncate">{value}</p>
      </div>
    </div>
  );
}
