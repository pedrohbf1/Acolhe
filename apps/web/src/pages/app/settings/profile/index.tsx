import Input from "@/components/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useZodForm } from "@/hooks/useZodForm";
import { authClient } from "@/lib/auth-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import z from "zod";

const schema = z.object({
  name: z.string().min(2, "Digite seu nome"),
});
type Schema = z.infer<typeof schema>;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Digite a senha atual"),
    newPassword: z.string().min(6, "Mínimo de 6 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não conferem",
  });
type PwSchema = z.infer<typeof passwordSchema>;

export default function ProfileSettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const {
    register: regProfile,
    formProps: profileFormProps,
    formState: { errors: profileErrors },
    reset,
  } = useZodForm(schema);

  useEffect(() => {
    if (user?.name) reset({ name: user.name });
  }, [user?.name, reset]);

  const updateName = useMutation({
    mutationFn: async (d: Schema) => {
      const res = await authClient.updateUser({ name: d.name });
      if ("error" in res && res.error) throw new Error(res.error.message);
      return res;
    },
    onSuccess: () => {
      toast.success("Perfil atualizado.");
      qc.invalidateQueries({ queryKey: ["session"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const {
    register: regPw,
    formProps: pwFormProps,
    formState: { errors: pwErrors },
    reset: resetPw,
  } = useZodForm(passwordSchema);

  const changePassword = useMutation({
    mutationFn: async (d: PwSchema) => {
      const res = await authClient.changePassword({
        currentPassword: d.currentPassword,
        newPassword: d.newPassword,
      });
      if ("error" in res && res.error) throw new Error(res.error.message);
      return res;
    },
    onSuccess: () => {
      toast.success("Senha alterada.");
      resetPw();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-8">
      <Card title="Informações da conta" description="Atualize seu nome.">
        <form
          {...profileFormProps((d) => updateName.mutate(d))}
          className="flex flex-col gap-4"
        >
          <Input
            title="Nome"
            register={regProfile("name")}
            error={profileErrors.name?.message}
            inputSubmit
          />
          <div>
            <span className="text-xs text-muted-foreground">
              E-mail: {user?.email}
            </span>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={updateName.isPending}>
              {updateName.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Alterar senha" description="Mantenha sua conta segura.">
        <form
          {...pwFormProps((d) => changePassword.mutate(d))}
          className="flex flex-col gap-4"
        >
          <Input
            title="Senha atual"
            type="password"
            register={regPw("currentPassword")}
            error={pwErrors.currentPassword?.message}
          />
          <Input
            title="Nova senha"
            type="password"
            register={regPw("newPassword")}
            error={pwErrors.newPassword?.message}
          />
          <Input
            title="Confirmar nova senha"
            type="password"
            register={regPw("confirmPassword")}
            error={pwErrors.confirmPassword?.message}
            inputSubmit
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={changePassword.isPending}>
              {changePassword.isPending ? "Alterando..." : "Alterar senha"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-6">
      <header className="mb-5">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </header>
      {children}
    </section>
  );
}
