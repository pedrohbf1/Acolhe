import Input from "@/components/input";
import AuthShell from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { useZodForm } from "@/hooks/useZodForm";
import { schemaLogin } from "@/schemas/auth/login";
import { LogIn } from "lucide-react";
import { Controller } from "react-hook-form";
import { Link } from "react-router-dom";

export default function LoginAuthPage() {
  const { login, loading } = useAuth();
  const {
    register,
    formProps,
    formState: { errors },
    control,
  } = useZodForm(schemaLogin);

  return (
    <AuthShell
      icon={LogIn}
      title="Entrar na sua conta"
      description="Digite suas credenciais para acessar."
      footer={
        <span>
          Não tem conta?{" "}
          <Link to="/register" className="text-primary font-medium hover:underline">
            Criar conta
          </Link>
        </span>
      }
    >
      <form {...formProps((d) => login(d))} className="w-full gap-4 flex flex-col">
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
        <div className="flex text-sm justify-between">
          <Controller
            control={control}
            name="rememberMe"
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="lembrar-de-mim"
                  checked={field.value || false}
                  onCheckedChange={field.onChange}
                />
                <label htmlFor="lembrar-de-mim" className="cursor-pointer">
                  Lembrar de mim
                </label>
              </div>
            )}
          />
          <Link
            to="/forgot-password"
            className="text-primary hover:underline"
          >
            Esqueci minha senha
          </Link>
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </Button>
      </form>
    </AuthShell>
  );
}
