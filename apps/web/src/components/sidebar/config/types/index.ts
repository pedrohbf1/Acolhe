import type { LucideIcon } from "lucide-react";


type NavItemWithChildren = {
    title: string;
    icon?: LucideIcon;
    isActive?: boolean;
    items: {
        title: string;
        url: string;
        icon?: LucideIcon;
        adminOnly?: boolean;
    }[];
};

type NavItemSingle = {
    title: string;
    url: string;
    icon?: LucideIcon;
    isActive?: boolean;
    adminOnly?: boolean;
};

type NavItem = NavItemWithChildren | NavItemSingle;

export type navGroup = {
    title: string,
    items: NavItem[]
    adminOnly?: boolean;
}
