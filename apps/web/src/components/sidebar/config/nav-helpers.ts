// src/components/sidebar/config/nav-helpers.ts
import type { navGroup } from "./types";

export type NavCrumb = { title: string; url?: string };

export function findNavTrailByPathname(
    groups: navGroup[],
    pathname: string,
): NavCrumb[] {
    for (const group of groups) {
        for (const item of group.items) {
            // item simples
            if (!("items" in item)) {
                if (item.url === pathname) {
                    return [
                        { title: group.title },
                        { title: item.title, url: item.url },
                    ];
                }
                continue;
            }

            // item com dropdown
            const sub = item.items.find((s) => s.url === pathname);
            if (sub) {
                return [
                    { title: group.title },
                    { title: item.title }, // pai (normalmente sem url)
                    { title: sub.title, url: sub.url },
                ];
            }
        }
    }

    return [];
}
