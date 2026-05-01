/**
 * Espelha o catálogo de planos do servidor (apps/api/src/config/plans.ts).
 * Usado para a tela de Pricing e badges. Os priceId reais ficam no servidor.
 */
import { Sparkles, Rocket, Crown, type LucideIcon } from "lucide-react";

export type PlanName = "free" | "pro" | "team";

export type PlanDisplay = {
  name: PlanName;
  label: string;
  tagline: string;
  priceMonthlyBRL: number | null;
  trialDays: number;
  icon: LucideIcon;
  highlight?: boolean;
  features: string[];
  limits: {
    maxOrganizations: number;
    maxPatients: number;
  };
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
      "Até 20 pacientes",
      "Suporte por e-mail",
    ],
    limits: { maxOrganizations: 1, maxPatients: 20 },
  },
  {
    name: "pro",
    label: "Pro",
    tagline: "Para profissionais autônomos",
    priceMonthlyBRL: 49,
    trialDays: 7,
    icon: Rocket,
    highlight: true,
    features: [
      "Até 3 organizações",
      "Até 150 pacientes",
      "7 dias grátis",
      "Suporte prioritário",
    ],
    limits: { maxOrganizations: 3, maxPatients: 150 },
  },
  {
    name: "team",
    label: "Team",
    tagline: "Para clínicas e equipes",
    priceMonthlyBRL: 149,
    trialDays: 7,
    icon: Crown,
    features: [
      "Até 5 organizações",
      "Até 500 pacientes",
      "7 dias grátis",
      "Suporte prioritário",
      "Onboarding dedicado",
    ],
    limits: { maxOrganizations: 5, maxPatients: 500 },
  },
];

export function getPlanDisplay(name?: string | null): PlanDisplay {
  return PLANS_DISPLAY.find((p) => p.name === name) ?? PLANS_DISPLAY[0];
}
