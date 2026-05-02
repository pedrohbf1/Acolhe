import { OrgSwitchOverlay } from "@/components/org-switch-overlay";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { findNavTrailByPathname } from "@/components/sidebar/config/nav-helpers";
import { sidebarNav } from "@/components/sidebar/config/navObject";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Outlet, useLocation } from "react-router-dom";

export default function DefaultAppPage() {
  const { pathname } = useLocation();

  const trail = findNavTrailByPathname(sidebarNav, pathname);

  return (
    <>
      <OrgSwitchOverlay />
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 shrink-0 bg-sidebar border-b border-sidebar-border items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1 cursor-pointer" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                {trail.length === 0 ? (
                  <BreadcrumbItem>
                    <BreadcrumbPage>App</BreadcrumbPage>
                  </BreadcrumbItem>
                ) : (
                  trail.map((c, idx) => {
                    const isLast = idx === trail.length - 1;

                    return (
                      <div
                        key={`${c.title}-${idx}`}
                        className="flex items-center"
                      >
                        <BreadcrumbItem>
                          {isLast ? (
                            <BreadcrumbPage>{c.title}</BreadcrumbPage>
                          ) : c.url ? (
                            <BreadcrumbLink href={c.url}>
                              {c.title}
                            </BreadcrumbLink>
                          ) : (
                            // quando não tem url (ex: "Settings" pai)
                            <BreadcrumbPage className="opacity-70">
                              {c.title}
                            </BreadcrumbPage>
                          )}
                        </BreadcrumbItem>

                        {!isLast && <BreadcrumbSeparator />}
                      </div>
                    );
                  })
                )}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <Outlet />
        </div>
      </SidebarInset>
    </>
  );
}
