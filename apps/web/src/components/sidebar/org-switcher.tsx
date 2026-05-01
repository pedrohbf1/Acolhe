import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  useActiveOrganization,
  useActivePlan,
  useOrganizations,
} from "@/hooks/useOrganizations";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { authClient } from "@/lib/auth-client";
import { getPlanDisplay } from "@/lib/plans";
import { useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Check,
  ChevronsUpDown,
  Plus,
  Settings,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export function OrgSwitcher() {
  const { state, isMobile } = useSidebar();
  const { data: orgs = [] } = useOrganizations();
  const { data: active } = useActiveOrganization();
  const planName = useActivePlan();
  const plan = getPlanDisplay(planName);
  const features = usePlanFeatures();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const setActive = async (orgId: string) => {
    const res = await authClient.organization.setActive({
      organizationId: orgId,
    });
    if ("error" in res && res.error) {
      toast.error(res.error.message ?? "Erro ao trocar de organização");
      return;
    }
    qc.invalidateQueries({ queryKey: ["organization", "active"] });
    qc.invalidateQueries({ queryKey: ["session"] });
  };

  const orgName = active?.name ?? orgs[0]?.name ?? "Carregando…";

  // Modo collapsed: só ícone, click vai pra settings
  if (state === "collapsed") {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            tooltip={orgName}
            onClick={() => navigate("/configuracoes/organizacao")}
            className="cursor-pointer"
          >
            <div className="size-8 rounded-md bg-primary/10 flex items-center justify-center">
              <Building2 className="size-4 text-primary" />
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <SidebarMenuButton
            render={<DropdownMenuTrigger />}
            size="lg"
            className="data-[state=open]:bg-sidebar-accent cursor-pointer data-[state=open]:text-sidebar-accent-foreground"
          >
            <div className="size-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="size-4 text-primary" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
              <span className="truncate font-medium">{orgName}</span>
              <span className="truncate text-xs text-muted-foreground">
                Plano {plan.label}
              </span>
            </div>
            <ChevronsUpDown className="ml-auto size-4 shrink-0" />
          </SidebarMenuButton>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-64 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="start"
            sideOffset={4}
          >
            {orgs.length > 0 && (
              <>
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  {orgs.length === 1 ? "Sua organização" : "Suas organizações"}
                </DropdownMenuLabel>
                {orgs.map((o) => {
                  const isActive = active?.id === o.id;
                  return (
                    <DropdownMenuItem
                      key={o.id}
                      onClick={() => !isActive && setActive(o.id)}
                      className="gap-2"
                    >
                      <Building2 className="size-4 text-muted-foreground" />
                      <span className="flex-1 truncate">{o.name}</span>
                      {isActive && <Check className="size-4 text-primary" />}
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator />
              </>
            )}

            <DropdownMenuItem
              onClick={() => navigate("/configuracoes/organizacao")}
              className="gap-2"
            >
              <Settings className="size-4" />
              Configurar organização
            </DropdownMenuItem>

            {features.canCreateOrg ? (
              <DropdownMenuItem
                onClick={() => navigate("/onboarding")}
                className="gap-2"
              >
                <Plus className="size-4" />
                Criar nova organização
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => navigate("/pricing")}
                className="gap-2 text-primary"
              >
                <Sparkles className="size-4" />
                Faça upgrade para Team
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
