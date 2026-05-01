import Input from "@/components/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/context/auth/useAuth";
import { useZodForm } from "@/hooks/useZodForm";
import { schemaLogin, type SchemaLogin } from "@/schemas/auth/login";
import { User } from "lucide-react";
import { Controller } from "react-hook-form";

export default function LoginAuthPage() {
  const { login } = useAuth();
  const {
    register,
    formProps,
    formState: { errors },
    control,
  } = useZodForm(schemaLogin);

  function submit(data: SchemaLogin) {
    login(data);
  }

  return (
    <div className="flex  h-full flex-col">
      <div className="flex">
        <div className="size-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold">
          u
        </div>
      </div>
      <main className="flex items-center justify-center h-full">
        <section className="fex w-full md:max-w-lg flex-col items-center justify-center flex gap-6">
          <div className=" size-25 bg-muted flex items-center justify-center rounded-full">
            <div className="size-20 bg-background rounded-full flex items-center justify-center">
              <User size={40} />
            </div>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-foreground">
              Entrar na sua Conta
            </h1>
            <p className="text-muted-foreground  mt-2">
              Digite suas credenciais para acessar sua conta.
            </p>
          </div>

          <form {...formProps(submit)} className="w-full gap-4 flex flex-col">
            <Input
              title="E-mail"
              required
              error={errors.email?.message}
              register={register("email")}
            />
            <Input
              title="Senha"
              required
              error={errors.password?.message}
              register={register("password")}
              type="password"
              inputSubmit
            />
            <div className="flex  text-sm justify-between">
              <div className="flex items-center gap-2">
                <Controller
                  control={control} // vem do useZodForm
                  name="rememberMe"
                  render={({ field }) => (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="lembrar-de-mim"
                        checked={field.value || false} // necessário para controlar o valor
                        onCheckedChange={field.onChange} // alguns componentes usam onCheckedChange
                      />
                      <label
                        htmlFor="lembrar-de-mim"
                        className="cursor-pointer"
                      >
                        Lembrar de mim
                      </label>
                    </div>
                  )}
                />
              </div>
            </div>
            <Button type="submit">Entrar</Button>
          </form>
        </section>
      </main>
    </div>
  );
}
