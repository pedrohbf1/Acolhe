import Input from "@/components/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
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
import { useActiveOrganization } from "@/hooks/useOrganizations";
import { useZodForm } from "@/hooks/useZodForm";
import { authClient } from "@/lib/auth-client";
import {
  schemaInviteMember,
  type SchemaInviteMember,
} from "@/schemas/org/invite";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MailPlus, MoreHorizontal, X } from "lucide-react";
import { useState } from "react";
import { Controller } from "react-hook-form";
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

export default function MembersSettingsPage() {
  const { user } = useAuth();
  const { data: org } = useActiveOrganization();
  const qc = useQueryClient();

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

  const [inviteOpen, setInviteOpen] = useState(false);
  const {
    register,
    formProps,
    formState: { errors },
    control,
    reset,
  } = useZodForm(schemaInviteMember, {
    defaultValues: { role: "user" },
  });

  const invite = useMutation({
    mutationFn: async (d: SchemaInviteMember) => {
      if (!org) throw new Error("Sem organização ativa");
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
      reset({ email: "", role: "user" });
      setInviteOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMember = useMutation({
    mutationFn: async (memberIdOrEmail: string) => {
      if (!org) throw new Error("Sem organização ativa");
      const res = await authClient.organization.removeMember({
        memberIdOrEmail,
        organizationId: org.id,
      });
      if ("error" in res && res.error) throw new Error(res.error.message);
      return res;
    },
    onSuccess: () => {
      toast.success("Membro removido.");
      qc.invalidateQueries({ queryKey: ["organization", "active"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelInvite = useMutation({
    mutationFn: async (invitationId: string) => {
      const res = await authClient.organization.cancelInvitation({
        invitationId,
      });
      if ("error" in res && res.error) throw new Error(res.error.message);
      return res;
    },
    onSuccess: () => {
      toast.success("Convite cancelado.");
      qc.invalidateQueries({ queryKey: ["invitations", org?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!org) {
    return (
      <div className="text-sm text-muted-foreground">
        Sem organização ativa.
      </div>
    );
  }

  const myRole = org.members?.find((m) => m.userId === user?.id)?.role;
  const canManage = myRole === "owner";
  const pendingInvites = invitations.filter((i) => i.status === "pending");

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-xl border bg-card p-6">
        <header className="flex items-start justify-between gap-4 mb-5 flex-wrap">
          <div>
            <h2 className="text-base font-semibold">Membros</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {org.members?.length ?? 0} membro
              {(org.members?.length ?? 0) === 1 ? "" : "s"} em {org.name}.
            </p>
          </div>
          {canManage && (
            <>
              <Button className="gap-2" onClick={() => setInviteOpen(true)}>
                <MailPlus className="size-4" />
                Convidar membro
              </Button>
              <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                <DialogContent>
                <DialogHeader>
                  <DialogTitle>Convidar membro</DialogTitle>
                  <DialogDescription>
                    Enviaremos um e-mail com o link de convite.
                  </DialogDescription>
                </DialogHeader>
                <form
                  {...formProps((d) => invite.mutate(d))}
                  className="flex flex-col gap-4"
                >
                  <Input
                    title="E-mail"
                    register={register("email")}
                    error={errors.email?.message}
                  />
                  <Controller
                    control={control}
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
            </>
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
                          className="text-destructive"
                          onClick={() => removeMember.mutate(m.id)}
                        >
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

      {pendingInvites.length > 0 && (
        <section className="rounded-xl border bg-card p-6">
          <header className="mb-5">
            <h2 className="text-base font-semibold">Convites pendentes</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {pendingInvites.length} convite
              {pendingInvites.length === 1 ? "" : "s"} aguardando resposta.
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
    </div>
  );
}
