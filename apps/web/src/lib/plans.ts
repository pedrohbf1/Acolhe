/**
 * Espelha o catálogo de planos do servidor (apps/api/src/config/plans.ts).
 * Usado para a tela de Pricing e badges. Os priceId reais ficam no servidor.
 */
import { Sparkles, Rocket, Crown, type LucideIcon } from "lucide-react";

export type PlanName = "free" | "pro" | "team";

export type PlanLimits = {
  maxOrganizations: number;
  maxPatients: number;
  maxMembers: number;
};

export type PlanFeatures = {
  auditLog: boolean;
  customRoles: boolean;
};

export type PlanDisplay = {
  name: PlanName;
  label: string;
  tagline: string;
  priceMonthlyBRL: number | null;
  trialDays: number;
  icon: LucideIcon;
  highlight?: boolean;
  features: string[];
  limits: PlanLimits;
  /** Features comportamentais — usado pelo usePlanFeatures pra gate. */
  capabilities: PlanFeatures;
};

export const PLANS_DISPLAY: PlanDisplay[] = [
  {
    name: "free",
    label: "Free",
    tagline: "Para começar",
    priceMonthlyBRL: 0,
    trialDays: 0,
    icon: Sparkles,
    features: [
      "1 organização",
      "Apenas você (sem convites)",
      "Até 10 pacientes",
      "Suporte por e-mail",
    ],
    limits: { maxOrganizations: 1, maxPatients: 10, maxMembers: 1 },
    capabilities: { auditLog: false, customRoles: false },
  },
  {
    name: "pro",
    label: "Pro",
    tagline: "Para profissionais autônomos",
    priceMonthlyBRL: 49.9,
    trialDays: 7,
    icon: Rocket,
    highlight: true,
    features: [
      "Até 3 organizações",
      "Você + 1 convidado (ex: secretária)",
      "Até 200 pacientes",
      "Logs de auditoria (LGPD)",
      "7 dias grátis",
      "Suporte prioritário",
    ],
    limits: { maxOrganizations: 3, maxPatients: 200, maxMembers: 2 },
    capabilities: { auditLog: true, customRoles: false },
  },
  {
    name: "team",
    label: "Team",
    tagline: "Para clínicas e equipes",
    priceMonthlyBRL: 149.9,
    trialDays: 7,
    icon: Crown,
    features: [
      "Até 5 organizações",
      "Até 5 membros por org",
      "Até 1.000 pacientes",
      "Cargos personalizados",
      "Logs de auditoria (LGPD)",
      "7 dias grátis",
      "Suporte prioritário",
    ],
    limits: { maxOrganizations: 5, maxPatients: 1000, maxMembers: 5 },
    capabilities: { auditLog: true, customRoles: true },
  },
];

export function getPlanDisplay(name?: string | null): PlanDisplay {
  return PLANS_DISPLAY.find((p) => p.name === name) ?? PLANS_DISPLAY[0];
}
