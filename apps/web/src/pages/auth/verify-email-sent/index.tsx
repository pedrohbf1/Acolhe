import AuthShell from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { MailCheck } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "sonner";

export default function VerifyEmailSentPage() {
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email;
  const [resending, setResending] = useState(false);

  async function resend() {
    if (!email) {
      toast.error("E-mail desconhecido. Faça login para reenviar.");
      return;
    }
    setResending(true);
    try {
      const res = await authClient.sendVerificationEmail({
        email,
        callbackURL: `${window.location.origin}/`,
      });
      if ("error" in res && res.error) {
        toast.error(res.error.message ?? "Erro ao reenviar");
        return;
      }
      toast.success("E-mail reenviado.");
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthShell
      icon={MailCheck}
      title="Confirme seu e-mail"
      description={
        email
          ? `Enviamos um link de confirmação para ${email}.`
          : "Enviamos um link de confirmação para o seu e-mail."
      }
      footer={
        <Link to="/" className="text-primary font-medium hover:underline">
          Voltar para o login
        </Link>
      }
    >
      <div className="w-full flex flex-col gap-3">
        <p className="text-sm text-muted-foreground text-center">
          Não recebeu? Verifique a caixa de spam ou peça um novo link.
        </p>
        <Button variant="outline" onClick={resend} disabled={resending || !email}>
          {resending ? "Reenviando..." : "Reenviar e-mail"}
        </Button>
      </div>
    </AuthShell>
  );
}
