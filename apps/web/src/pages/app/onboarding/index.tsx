import Input from "@/components/input";
import { Button } from "@/components/ui/button";
import { useZodForm } from "@/hooks/useZodForm";
import { authClient } from "@/lib/auth-client";
import {
  schemaCreateOrganization,
  type SchemaCreateOrganization,
} from "@/schemas/org/create";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40);
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const {
    register,
    formProps,
    formState: { errors },
    watch,
    setValue,
  } = useZodForm(schemaCreateOrganization);

  // auto-fill slug from name
  const name = watch("name");
  const slug = watch("slug");
  useEffect(() => {
    if (!slug && name) setValue("slug", slugify(name));
  }, [name, slug, setValue]);

  const create = useMutation({
    mutationFn: async (data: SchemaCreateOrganization) => {
      const res = await authClient.organization.create({
        name: data.name,
        slug: data.slug,
      });
      if ("error" in res && res.error) throw new Error(res.error.message);
      return res;
    },
    onSuccess: () => {
      toast.success("Organização criada!");
      qc.invalidateQueries({ queryKey: ["organizations"] });
      qc.invalidateQueries({ queryKey: ["session"] });
      navigate("/");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex h-full items-center justify-center">
      <section className="w-full max-w-md flex flex-col gap-6">
        <div className="size-16 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center">
          <Building2 className="size-8 text-primary" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Crie sua organização
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Esse é o espaço onde você organiza pacientes, equipe e cobrança.
            Você pode criar mais organizações depois.
          </p>
        </div>

        <form
          {...formProps((d) => create.mutate(d))}
          className="w-full flex flex-col gap-4"
        >
          <Input
            title="Nome"
            required
            register={register("name")}
            error={errors.name?.message}
            inputConfig={{ placeholder: "Clínica Bem-Estar" }}
          />
          <Input
            title="Identificador (URL)"
            required
            register={register("slug")}
            error={errors.slug?.message}
            inputConfig={{ placeholder: "clinica-bem-estar" }}
            inputSubmit
          />
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Criando..." : "Criar organização"}
          </Button>
        </form>
      </section>
    </div>
  );
}
