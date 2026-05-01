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
import { useActiveOrganization } from "@/hooks/useOrganizations";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { useZodForm } from "@/hooks/useZodForm";
import { authClient } from "@/lib/auth-client";
import {
  schemaCreateOrganization,
  type SchemaCreateOrganization,
} from "@/schemas/org/create";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function OrganizationSettingsPage() {
  const { data: org } = useActiveOrganization();
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

  if (!org) {
    return (
      <div className="text-sm text-muted-foreground">
        Sem organização ativa.
      </div>
    );
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
