import Stripe from "stripe";
import { env } from "@/config/env";

/**
 * Stripe client compartilhado por toda a app — reutilizamos o mesmo client em
 * `auth.ts` (better-auth-stripe) e em modules custom (como `admin` para custom
 * plans). Mantém versão de API consistente.
 */
export const stripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-04-22.dahlia",
});
