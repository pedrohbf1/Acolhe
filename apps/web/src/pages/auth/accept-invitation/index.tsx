import AuthShell from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { authClient } from "@/lib/auth-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, MailQuestion } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

export default function AcceptInvitationPage() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["invitation", id],
    queryFn: async () => {
      const res = await authClient.organization.getInvitation({
        query: { id: id! },
      });
      if ("error" in res && res.error) throw new Error(res.error.message);
      return "data" in res ? res.data : null;
    },
    enabled: !!id && isAuthenticated,
    retry: false,
  });

  const accept = useMutation({
    mutationFn: async () => {
      const res = await authClient.organization.acceptInvitation({
        invitationId: id!,
      });
      if ("error" in res && res.error) throw new Error(res.error.message);
      return res;
    },
    onSuccess: () => {
      toast.success("Convite aceito! Bem-vindo à organização.");
      qc.invalidateQueries({ queryKey: ["session"] });
      qc.invalidateQueries({ queryKey: ["organizations"] });
      navigate("/");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: async () => {
      const res = await authClient.organization.rejectInvitation({
        invitationId: id!,
      });
      if ("error" in res && res.error) throw new Error(res.error.message);
      return res;
    },
    onSuccess: () => {
      toast.success("Convite recusado.");
      navigate("/");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAuthenticated) {
    return (
      <AuthShell
        icon={MailQuestion}
        title="Você foi convidado"
        description="Faça login ou crie uma conta para aceitar o convite."
        footer={
          <span>
            <Link
              to={`/?redirect=/accept-invitation/${id}`}
              className="text-primary font-medium hover:underline"
            >
              Entrar
            </Link>{" "}
            ·{" "}
            <Link
              to={`/register?redirect=/accept-invitation/${id}`}
              className="text-primary font-medium hover:underline"
            >
              Criar conta
            </Link>
          </span>
        }
      >
        <span />
      </AuthShell>
    );
  }

  if (isLoading) {
    return (
      <AuthShell
        icon={MailQuestion}
        title="Carregando convite..."
        description=" "
      >
        <span />
      </AuthShell>
    );
  }

  if (error || !data) {
    return (
      <AuthShell
        icon={MailQuestion}
        title="Convite inválido"
        description="Este convite não existe, expirou ou já foi usado."
        footer={
          <Link to="/" className="text-primary font-medium hover:underline">
            Voltar
          </Link>
        }
      >
        <span />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      icon={Building2}
      title={`Entrar em ${data.organizationName}`}
      description={`Você foi convidado para participar como ${data.role ?? "membro"}.`}
    >
      <div className="w-full flex flex-col gap-3">
        <Button
          onClick={() => accept.mutate()}
          disabled={accept.isPending || reject.isPending}
        >
          {accept.isPending ? "Aceitando..." : "Aceitar convite"}
        </Button>
        <Button
          variant="outline"
          onClick={() => reject.mutate()}
          disabled={accept.isPending || reject.isPending}
        >
          {reject.isPending ? "Recusando..." : "Recusar"}
        </Button>
      </div>
    </AuthShell>
  );
}
