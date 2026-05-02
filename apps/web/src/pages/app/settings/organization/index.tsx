import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  useActiveOrganization,
  useOrganizations,
} from "@/hooks/useOrganizations";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { useSwitchOrganization } from "@/hooks/useSwitchOrganization";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  Check,
  Loader2,
  Plus,
  Sparkles,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function OrganizationSettingsPage() {
  const { data: active, isLoading: loadingActive } = useActiveOrganization();
  const { data: orgs = [], isLoading: loadingList } = useOrganizations();
  const features = usePlanFeatures();
  const switchOrg = useSwitchOrganization();
  const navigate = useNavigate();

  if (loadingActive || loadingList) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Carregando…
      </div>
    );
  }

  if (!active && orgs.length === 0) {
    return <NoOrgFallback />;
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold">Suas organizações</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Clique em uma organização para ver detalhes ou use{" "}
            <strong>Ativar</strong> para trocar de contexto sem sair daqui.
          </p>
        </div>
        {features.canCreateOrg ? (
          <Button className="gap-2" onClick={() => navigate("/onboarding")}>
            <Plus className="size-4" /> Nova organização
          </Button>
        ) : (
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => navigate("/pricing")}
          >
            <Sparkles className="size-4 text-primary" /> Upgrade para Team
          </Button>
        )}
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {orgs.map((o) => {
          const isActive = o.id === active?.id;
          const isPending =
            switchOrg.isPending && switchOrg.variables === o.id;
          return (
            <div
              key={o.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/configuracoes/organizacao/${o.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(`/configuracoes/organizacao/${o.id}`);
                }
              }}
              className={cn(
                "group relative rounded-xl border bg-card p-5 transition-all cursor-pointer",
                "hover:border-primary/50 hover:shadow-sm hover:-translate-y-0.5",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                isActive && "border-primary/40 ring-1 ring-primary/20",
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "size-11 rounded-xl flex items-center justify-center shrink-0 overflow-hidden",
                    isActive ? "bg-primary/15" : "bg-muted",
                  )}
                >
                  {o.logo ? (
                    <img
                      src={o.logo}
                      alt=""
                      className="size-11 object-cover"
                    />
                  ) : (
                    <Building2
                      className={cn(
                        "size-5",
                        isActive ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold truncate">
                      {o.name}
                    </h3>
                    {isActive && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-primary/15 text-primary tracking-wide">
                        <Check className="size-3" />
                        ATIVA
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    /{o.slug}
                  </p>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                {isActive ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Check className="size-3.5 text-primary" />
                    Em uso
                  </span>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={switchOrg.isPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      switchOrg.mutate(o.id);
                    }}
                  >
                    {isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Zap className="size-3.5" />
                    )}
                    {isPending ? "Ativando…" : "Ativar"}
                  </Button>
                )}

                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                  Detalhes
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Fallback: nenhuma org ───────────────────────────────────────────────────

function NoOrgFallback() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: async () => {
      const slug = `c-${user?.id.slice(0, 16).toLowerCase()}`;
      const res = await authClient.organization.create({
        name: "Meu consultório",
        slug,
      });
      if ("error" in res && res.error) throw new Error(res.error.message);
      return res;
    },
    onSuccess: () => {
      toast.success("Organização criada.");
      qc.invalidateQueries({ queryKey: ["organizations"] });
      qc.invalidateQueries({ queryKey: ["organization", "active"] });
      qc.invalidateQueries({ queryKey: ["session"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-xl border bg-card p-8 text-center">
      <div className="size-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <Building2 className="size-6 text-primary" />
      </div>
      <h2 className="text-lg font-semibold">
        Você ainda não tem uma organização
      </h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
        Crie sua primeira organização — é nela que ficam pacientes, agenda e
        equipe.
      </p>
      <Button
        className="mt-5 gap-2"
        onClick={() => create.mutate()}
        disabled={create.isPending}
      >
        <Plus className="size-4" />
        {create.isPending ? "Criando..." : "Criar organização"}
      </Button>
    </section>
  );
}
