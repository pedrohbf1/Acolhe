import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useActiveOrganization } from "@/hooks/useOrganizations";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { authClient } from "@/lib/auth-client";
import {
  ACTION_LABELS,
  RESOURCE_LABELS,
  STATEMENT_KEYS,
} from "@/lib/permissions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

type Permission = Record<string, string[]>;

interface OrgRole {
  id: string;
  role: string;
  permission: Permission;
}

export default function RolesSettingsPage() {
  const features = usePlanFeatures();
  const { data: org } = useActiveOrganization();
  const qc = useQueryClient();

  const { data: roles = [], isLoading } = useQuery<OrgRole[]>({
    queryKey: ["org-roles", org?.id],
    queryFn: async () => {
      if (!org) return [];
      const res = await authClient.organization.listRoles({
        query: { organizationId: org.id },
      });
      if ("error" in res && res.error) throw new Error(res.error.message);
      const data = "data" in res ? (res.data ?? []) : [];
      return data as unknown as OrgRole[];
    },
    enabled: !!org && features.canManageRoles,
  });

  const [editing, setEditing] = useState<OrgRole | null>(null);
  const [creating, setCreating] = useState(false);

  if (!features.canManageRoles) {
    return <UpsellPanel />;
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border bg-card p-6">
        <header className="flex items-start justify-between gap-4 mb-5 flex-wrap">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <ShieldCheck className="size-4" />
              Cargos
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Crie cargos personalizados (ex: Secretaria, Psicólogo Júnior) e
              defina exatamente o que cada um pode fazer.
            </p>
          </div>
          <Button className="gap-2" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Novo cargo
          </Button>
        </header>

        <ul className="divide-y divide-border">
          {/* Default roles ─ não editáveis */}
          <DefaultRoleRow
            name="owner"
            description="Acesso total. Não pode ser removido."
          />
          <DefaultRoleRow
            name="user"
            description="Membro padrão. Apenas leitura básica."
          />

          {isLoading && (
            <li className="py-3 text-sm text-muted-foreground">Carregando…</li>
          )}

          {roles.map((r) => (
            <CustomRoleRow
              key={r.id}
              role={r}
              onEdit={() => setEditing(r)}
              onDelete={() => {
                if (!org) return;
                authClient.organization
                  .deleteRole({ roleName: r.role, organizationId: org.id })
                  .then((res) => {
                    if ("error" in res && res.error) {
                      toast.error(res.error.message);
                    } else {
                      toast.success("Cargo removido.");
                      qc.invalidateQueries({ queryKey: ["org-roles", org.id] });
                    }
                  });
              }}
            />
          ))}
        </ul>
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
            qc.invalidateQueries({ queryKey: ["org-roles", org?.id] });
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function UpsellPanel() {
  return (
    <section className="rounded-xl border bg-card p-8 text-center">
      <div className="size-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <Lock className="size-6 text-primary" />
      </div>
      <h2 className="text-lg font-semibold">
        Cargos personalizados estão no plano Team
      </h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
        Defina exatamente o que cada membro da sua equipe pode ver e editar:
        secretaria sem acesso a prontuário, financeiro só pra você, etc.
      </p>
      <Link to="/pricing">
        <Button className="mt-5">Ver plano Team</Button>
      </Link>
    </section>
  );
}

function DefaultRoleRow({
  name,
  description,
}: {
  name: string;
  description: string;
}) {
  return (
    <li className="flex items-center justify-between py-3 gap-3">
      <div>
        <div className="text-sm font-medium capitalize flex items-center gap-2">
          {name}
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wide">
            Padrão
          </span>
        </div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <Lock className="size-4 text-muted-foreground" />
    </li>
  );
}

function CustomRoleRow({
  role,
  onEdit,
  onDelete,
}: {
  role: OrgRole;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const perm = parsePermission(role.permission);
  const totalPerms = Object.values(perm).reduce((a, b) => a + b.length, 0);
  return (
    <li className="flex items-center justify-between py-3 gap-3">
      <div>
        <div className="text-sm font-medium">{role.role}</div>
        <div className="text-xs text-muted-foreground">
          {totalPerms} permiss{totalPerms === 1 ? "ão" : "ões"} configurada
          {totalPerms === 1 ? "" : "s"}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={onEdit}>
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  );
}

function parsePermission(raw: Permission | string | undefined | null): Permission {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Permission;
    } catch {
      return {};
    }
  }
  return raw;
}

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
  const [name, setName] = useState(role?.role ?? "");
  const [perm, setPerm] = useState<Permission>(() =>
    role ? parsePermission(role.permission) : {},
  );

  useEffect(() => {
    setName(role?.role ?? "");
    setPerm(role ? parsePermission(role.permission) : {});
  }, [role]);

  const togglePerm = (resource: string, action: string) => {
    setPerm((p) => {
      const set = new Set(p[resource] ?? []);
      if (set.has(action)) set.delete(action);
      else set.add(action);
      return { ...p, [resource]: Array.from(set) };
    });
  };

  const toggleAllResource = (resource: string, all: string[]) => {
    setPerm((p) => {
      const current = p[resource] ?? [];
      return {
        ...p,
        [resource]: current.length === all.length ? [] : [...all],
      };
    });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("Sem organização ativa");
      if (!name.trim()) throw new Error("Dê um nome para o cargo");
      const slug = name.trim().toLowerCase().replace(/\s+/g, "_");
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
        if ("error" in res && res.error) throw new Error(res.error.message);
      } else {
        const res = await authClient.organization.createRole({
          role: slug,
          organizationId: orgId,
          permission: cleanPerm,
        });
        if ("error" in res && res.error) throw new Error(res.error.message);
      }
    },
    onSuccess: () => {
      toast.success(role ? "Cargo atualizado." : "Cargo criado.");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{role ? `Editar cargo` : "Novo cargo"}</DialogTitle>
          <DialogDescription>
            Marque exatamente o que membros com este cargo podem fazer.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 flex flex-col gap-5 max-h-[60dvh] overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Nome do cargo
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Secretaria, Psicólogo Júnior"
              disabled={!!role}
              className="border border-border rounded-lg p-3 disabled:opacity-60 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            />
            {role && (
              <span className="text-xs text-muted-foreground">
                Nome não pode ser alterado depois de criado.
              </span>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <div className="text-sm font-medium">Permissões</div>
            <div className="rounded-lg border divide-y">
              {STATEMENT_KEYS.map((s) => {
                const selected = perm[s.resource] ?? [];
                const all = [...s.actions];
                const allChecked =
                  selected.length === all.length && all.length > 0;
                return (
                  <div key={s.resource} className="p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">
                          {RESOURCE_LABELS[s.resource] ?? s.resource}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {s.resource}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleAllResource(s.resource, all)}
                        className="text-xs text-primary hover:underline"
                      >
                        {allChecked ? "Desmarcar tudo" : "Marcar tudo"}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {s.actions.map((a) => {
                        const checked = selected.includes(a);
                        return (
                          <button
                            type="button"
                            key={a}
                            onClick={() => togglePerm(s.resource, a)}
                            className={
                              "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors " +
                              (checked
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background text-foreground border-border hover:border-primary/40")
                            }
                          >
                            {ACTION_LABELS[a] ?? a}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending
              ? "Salvando..."
              : role
              ? "Salvar alterações"
              : "Criar cargo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
