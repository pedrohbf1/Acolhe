import type { Routes } from "../type";
import DashboardPage from "@/pages/app/dashboard";
import OnboardingPage from "@/pages/app/onboarding";
import PricingPage from "@/pages/app/pricing";
import SettingsLayout from "@/pages/app/settings/layout";
import ProfileSettingsPage from "@/pages/app/settings/profile";
import OrganizationSettingsPage from "@/pages/app/settings/organization";
import MembersSettingsPage from "@/pages/app/settings/members";
import BillingSettingsPage from "@/pages/app/settings/billing";
import AcceptInvitationPage from "@/pages/auth/accept-invitation";

export const routesApp: Routes[] = [
  { path: "/", element: <DashboardPage /> },
  { path: "/onboarding", element: <OnboardingPage /> },
  { path: "/pricing", element: <PricingPage /> },
  { path: "/accept-invitation/:id", element: <AcceptInvitationPage /> },
  {
    path: "/configuracoes",
    element: <SettingsLayout />,
    children: [
      { path: "perfil", element: <ProfileSettingsPage /> },
      { path: "organizacao", element: <OrganizationSettingsPage /> },
      { path: "membros", element: <MembersSettingsPage /> },
      { path: "billing", element: <BillingSettingsPage /> },
    ],
  },
];
