import { authClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";

export function useOrganizations() {
  return useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const res = await authClient.organization.list();
      if ("error" in res && res.error) throw new Error(res.error.message);
      return "data" in res ? (res.data ?? []) : [];
    },
  });
}

export function useActiveOrganization() {
  return useQuery({
    queryKey: ["organization", "active"],
    queryFn: async () => {
      const res = await authClient.organization.getFullOrganization();
      if ("error" in res && res.error) return null;
      return "data" in res ? res.data : null;
    },
    retry: false,
  });
}

export function useSubscriptions() {
  return useQuery({
    queryKey: ["subscriptions"],
    queryFn: async () => {
      const res = await authClient.subscription.list();
      if ("error" in res && res.error) throw new Error(res.error.message);
      return "data" in res ? (res.data ?? []) : [];
    },
  });
}

export function useActivePlan() {
  const { data: subs } = useSubscriptions();
  const active = subs?.find(
    (s) => s.status === "active" || s.status === "trialing",
  );
  return active?.plan ?? "free";
}
