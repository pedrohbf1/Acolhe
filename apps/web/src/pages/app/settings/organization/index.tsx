import Input from "@/components/input";
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
  useActiveOrganization,
  useOrganizations,
} from "@/hooks/useOrganizations";
import { useAuth } from "@/hooks/useAuth";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { useZodForm } from "@/hooks/useZodForm";
import { authClient } from "@/lib/auth-client";
import {
  schemaCreateOrganization,
  type SchemaCreateOrganization,
} from "@/schemas/org/create";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function OrganizationSettingsPage() {
  const { data: org, isLoading: loadingActive } = useActiveOrganization();
  const { data: allOrgs, isLoading: loadingList } = useOrganizations();
  const features = usePlanFeatures();
  const qc = useQueryClient();

  const {
    register,
    formProps,
    formState: { errors },
    reset,
  } = useZodForm(schemaCreateOrganization);

  useEffect(() => {
    if (org) reset({ name: org.name, slug: org.slug });
  }, [org, reset]);

  const update = useMutation({
    mutationFn: async (d: SchemaCreateOrganization) => {
      if (!org) throw new Error("Sem organização ativa");
      const res = await authClient.organization.update({
        organizationId: org.id,
        data: { name: d.name, slug: d.slug },
      });
      if ("error" in res && res.error) throw new Error(res.error.message);
      return res;
    },
    onSuccess: () => {
      toast.success("Organização atualizada.");
      qc.invalidateQueries({ queryKey: ["organization", "active"] });
      qc.invalidateQueries({ queryKey: ["organizations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const remove = useMutation({
    mutationFn: async () => {
      if (!org) throw new Error("Sem organização ativa");
      const res = await authClient.organization.delete({
        organizationId: org.id,
      });
      if ("error" in res && res.error) throw new Error(res.error.message);
      return res;
    },
    onSuccess: () => {
      toast.success("Organização excluída.");
      qc.invalidateQueries({ queryKey: ["organizations"] });
      qc.invalidateQueries({ queryKey: ["organization", "active"] });
      qc.invalidateQueries({ queryKey: ["session"] });
      setConfirmOpen(false);
      window.location.href = "/";
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loadingActive || loadingList) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Carregando…
      </div>
    );
  }

  if (!org) {
    // Fallback raríssimo: o useEnsureActiveOrg deveria ter resolvido isso.
    // Pode acontecer se o usuário deletou todas as orgs e o hook ainda não
    // rodou, ou se a criação falhou silenciosa. Damos um botão manual.
    return <NoOrgFallback hasOrgsButNoneActive={(allOrgs?.length ?? 0) > 0} />;
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-xl border bg-card p-6">
        <header className="mb-5">
          <h2 className="text-base font-semibold">Detalhes da organização</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Nome visível para todos os membros e identificador da URL.
          </p>
        </header>
        <form
          {...formProps((d) => update.mutate(d))}
          className="flex flex-col gap-4"
        >
          <Input
            title="Nome"
            register={register("name")}
            error={errors.name?.message}
          />
          <Input
            title="Identificador (URL)"
            register={register("slug")}
            error={errors.slug?.message}
            inputSubmit
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </section>

      {features.isTeamPlan && (
      <section className="rounded-xl border border-destructive/30 bg-destructive/2 p-6">
        <header className="mb-5">
          <h2 className="text-base font-semibold text-destructive">
            Zona de perigo
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Excluir a organização remove permanentemente todos os dados, membros
            e convites associados.
          </p>
        </header>
        <Button
          variant="destructive"
          className="gap-2"
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 className="size-4" /> Excluir organização
        </Button>
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Excluir {org.name}?</DialogTitle>
              <DialogDescription>
                Esta ação é irreversível. Todos os dados, membros e convites
                serão removidos. Para confirmar, digite{" "}
                <strong>{org.slug}</strong> abaixo.
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
                onClick={() => setConfirmOpen(false)}
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
      </section>
      )}
    </div>
  );
}

// ─── Fallback: sem org ativa ─────────────────────────────────────────────────

function NoOrgFallback({
  hasOrgsButNoneActive,
}: {
  hasOrgsButNoneActive: boolean;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: async () => {
      const slug = `c-${user?.id.slice(0, 16).toLowerCase()}`;
      const res = await authClient.organization.create({
        name: "Meu consultório",
        slug,
      });
      if ("error" in res && res.error) throw new Error(res.error.message);
      return res;
    },
    onSuccess: () => {
      toast.success("Organização criada.");
      qc.invalidateQueries({ queryKey: ["organizations"] });
      qc.invalidateQueries({ queryKey: ["organization", "active"] });
      qc.invalidateQueries({ queryKey: ["session"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setFirst = useMutation({
    mutationFn: async () => {
      const list = await authClient.organization.list();
      const orgs = "data" in list ? (list.data ?? []) : [];
      if (orgs.length === 0) throw new Error("Sem orgs disponíveis");
      const res = await authClient.organization.setActive({
        organizationId: orgs[0].id,
      });
      if ("error" in res && res.error) throw new Error(res.error.message);
    },
    onSuccess: () => {
      toast.success("Organização ativada.");
      qc.invalidateQueries({ queryKey: ["organizations"] });
      qc.invalidateQueries({ queryKey: ["organization", "active"] });
      qc.invalidateQueries({ queryKey: ["session"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-xl border bg-card p-8 text-center">
      <div className="size-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <Building2 className="size-6 text-primary" />
      </div>
      <h2 className="text-lg font-semibold">
        {hasOrgsButNoneActive
          ? "Nenhuma organização ativa"
          : "Você ainda não tem uma organização"}
      </h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
        {hasOrgsButNoneActive
          ? "Selecione uma organização para continuar."
          : "Crie sua primeira organização — é nela que ficam pacientes, agenda e equipe."}
      </p>
      <Button
        className="mt-5 gap-2"
        onClick={() =>
          hasOrgsButNoneActive ? setFirst.mutate() : create.mutate()
        }
        disabled={create.isPending || setFirst.isPending}
      >
        <Plus className="size-4" />
        {create.isPending || setFirst.isPending
          ? "Processando..."
          : hasOrgsButNoneActive
          ? "Ativar primeira organização"
          : "Criar organização"}
      </Button>
    </section>
  );
}
