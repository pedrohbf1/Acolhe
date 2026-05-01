import { ChevronRight } from "lucide-react";

import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { navGroup } from "./config/types";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";

export function NavMain({ items }: { items: navGroup[] }) {
  const { state, setOpen } = useSidebar();
  const location = useLocation();
  const pathname = location.pathname;
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
  const { isAdmin } = useAuth();

  const visibleItems = items.filter((g) => !g.adminOnly || isAdmin);

  return (
    <>
      {visibleItems.map((group) => (
        <SidebarGroup key={group.title}>
          <SidebarGroupLabel>{group.title}</SidebarGroupLabel>

          <SidebarMenu className="gap-1">
            {group.items.map((item) => {
              if ("items" in item) {
                const activeSubItem = item.items.find(
                  (sub) => sub.url === pathname,
                );
                const isOpen = openItems[item.title] ?? false;

                const shouldHighlightParent =
                  Boolean(activeSubItem) && (!isOpen || state === "collapsed");
                return (
                  <Collapsible
                    onOpenChange={(value) =>
                      setOpenItems((prev) => ({
                        ...prev,
                        [item.title]: value,
                      }))
                    }
                    key={item.title}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        render={<CollapsibleTrigger />}
                        onClick={() => {
                          if (state === "collapsed") setOpen(true);
                        }}
                        className={cn(
                          "relative overflow-hidden cursor-pointer transition-all",
                          shouldHighlightParent &&
                            "text-primary-foreground active:text-primary-foreground hover:text-primary-foreground",
                        )}
                        tooltip={item.title}
                      >
                        {item.icon && <item.icon className="relative z-10" />}

                        {state === "collapsed" && (
                          <span className="absolute bottom-1 -right-1 flex gap-px">
                            <span className="w-0.75 h-0.75 rounded-full bg-muted-foreground/70" />
                            <span className="w-0.75 h-0.75 rounded-full bg-muted-foreground/70" />
                            <span className="w-0.75 h-0.75 rounded-full bg-muted-foreground/70" />
                          </span>
                        )}
                        <span className="relative z-10">{item.title}</span>

                        {state !== "collapsed" && (
                          <ChevronRight className="ml-auto z-10 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        )}

                        {shouldHighlightParent && <ActivePill />}
                      </SidebarMenuButton>

                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            key="submenu"
                            initial={{ height: 0, opacity: 0, y: -4 }}
                            animate={{ height: "auto", opacity: 1, y: 0 }}
                            exit={{ height: 0, opacity: 0, y: -4 }}
                            transition={{
                              duration: 0.22,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                            style={{ overflow: "hidden" }}
                          >
                            <SidebarMenuSub className="mt-1">
                              {item.items.filter((s) => !s.adminOnly || isAdmin).map((subItem) => (
                                <SidebarMenuSubItem key={subItem.title}>
                                  <SidebarMenuSubButton
                                    render={<Link to={subItem.url} />}
                                    className={cn(
                                      subItem.url === pathname &&
                                        "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                                    )}
                                  >
                                    {subItem.icon && (
                                      <subItem.icon className="size-3.5 shrink-0" />
                                    )}
                                    {subItem.title}
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </SidebarMenuItem>
                  </Collapsible>
                );
              }

              const isActive = item.url === pathname;

              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    render={<Link to={item.url} />}
                    className={cn(
                      isActive &&
                        "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                    )}
                    tooltip={item.title}
                  >
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  );
}

function ActivePill() {
  return (
    <motion.span
      layoutId="sidebar-active-pill"
      className="absolute inset-0 z-0 rounded-md bg-primary pointer-events-none"
      transition={{ type: "spring", stiffness: 520, damping: 38 }}
    />
  );
}
