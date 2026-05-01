import { NavMain } from "@/components/sidebar/nav-main";
import { NavUser } from "@/components/sidebar/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { getSidebarConfig } from "./config/sidebar-data";

function SidebarLogo() {
  const { state } = useSidebar();
  return state === "collapsed" ? (
    <div className="size-8 flex items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
      u
    </div>
  ) : (
    <div className="h-7 flex items-center text-base font-semibold tracking-tight">
      useAcolhe
    </div>
  );
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { sidebarNav } = getSidebarConfig({});

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarLogo />
      </SidebarHeader>
      <SidebarContent className="no-scrollbar">
        <NavMain items={sidebarNav} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
