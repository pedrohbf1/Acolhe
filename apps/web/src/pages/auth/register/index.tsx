import Input from "@/components/input";
import AuthShell from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useZodForm } from "@/hooks/useZodForm";
import { schemaRegister, type SchemaRegister } from "@/schemas/auth/register";
import { UserPlus } from "lucide-react";
import { Link } from "react-router-dom";

export default function RegisterAuthPage() {
  const { register: registerUser, loading } = useAuth();
  const {
    register,
    formProps,
    formState: { errors },
  } = useZodForm(schemaRegister);

  return (
    <AuthShell
      icon={UserPlus}
      title="Criar sua conta"
      description="Comece grátis em menos de um minuto."
      footer={
        <span>
          Já tem conta?{" "}
          <Link to="/" className="text-primary font-medium hover:underline">
            Entrar
          </Link>
        </span>
      }
    >
      <form
        {...formProps((d: SchemaRegister) => registerUser(d))}
        className="w-full gap-4 flex flex-col"
      >
        <Input
          title="Nome"
          required
          error={errors.name?.message}
          register={register("name")}
        />
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
        />
        <Input
          title="Confirmar senha"
          required
          error={errors.confirmPassword?.message}
          register={register("confirmPassword")}
          type="password"
          inputSubmit
        />
        <Button type="submit" disabled={loading}>
          {loading ? "Criando..." : "Criar conta"}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          Ao continuar, você concorda com nossos termos de uso.
        </p>
      </form>
    </AuthShell>
  );
}
