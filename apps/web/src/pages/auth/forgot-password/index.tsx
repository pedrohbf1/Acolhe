import Input from "@/components/input";
import AuthShell from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useZodForm } from "@/hooks/useZodForm";
import {
  schemaForgotPassword,
  type SchemaForgotPassword,
} from "@/schemas/auth/forgot-password";
import { KeyRound } from "lucide-react";
import { Link } from "react-router-dom";

export default function ForgotPasswordPage() {
  const { forgotPassword, loading } = useAuth();
  const {
    register,
    formProps,
    formState: { errors },
  } = useZodForm(schemaForgotPassword);

  return (
    <AuthShell
      icon={KeyRound}
      title="Esqueceu sua senha?"
      description="Digite seu e-mail e enviaremos um link para redefinir."
      footer={
        <span>
          Lembrou?{" "}
          <Link to="/" className="text-primary font-medium hover:underline">
            Voltar para o login
          </Link>
        </span>
      }
    >
      <form
        {...formProps((d: SchemaForgotPassword) => forgotPassword(d))}
        className="w-full gap-4 flex flex-col"
      >
        <Input
          title="E-mail"
          required
          error={errors.email?.message}
          register={register("email")}
          inputSubmit
        />
        <Button type="submit" disabled={loading}>
          {loading ? "Enviando..." : "Enviar link de redefinição"}
        </Button>
      </form>
    </AuthShell>
  );
}
