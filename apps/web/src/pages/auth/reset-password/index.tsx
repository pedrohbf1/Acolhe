import Input from "@/components/input";
import AuthShell from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useZodForm } from "@/hooks/useZodForm";
import {
  schemaResetPassword,
  type SchemaResetPassword,
} from "@/schemas/auth/reset-password";
import { LockKeyhole, ShieldAlert } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const { resetPassword, loading } = useAuth();

  const {
    register,
    formProps,
    formState: { errors },
  } = useZodForm(schemaResetPassword);

  if (!token) {
    return (
      <AuthShell
        icon={ShieldAlert}
        title="Link inválido"
        description="O link de redefinição é inválido ou expirou."
        footer={
          <Link
            to="/forgot-password"
            className="text-primary font-medium hover:underline"
          >
            Solicitar um novo link
          </Link>
        }
      >
        <span />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      icon={LockKeyhole}
      title="Criar nova senha"
      description="Escolha uma senha forte que você lembre."
      footer={
        <Link to="/" className="text-primary font-medium hover:underline">
          Voltar para o login
        </Link>
      }
    >
      <form
        {...formProps((d: SchemaResetPassword) => resetPassword({ ...d, token }))}
        className="w-full gap-4 flex flex-col"
      >
        <Input
          title="Nova senha"
          required
          error={errors.password?.message}
          register={register("password")}
          type="password"
        />
        <Input
          title="Confirmar nova senha"
          required
          error={errors.confirmPassword?.message}
          register={register("confirmPassword")}
          type="password"
          inputSubmit
        />
        <Button type="submit" disabled={loading}>
          {loading ? "Redefinindo..." : "Redefinir senha"}
        </Button>
      </form>
    </AuthShell>
  );
}
