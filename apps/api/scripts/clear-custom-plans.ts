/**
 * One-shot: apaga registros antigos da tabela custom_plan pra permitir a
 * migration que adiciona campos required (userId, stripeProductId etc).
 *
 * Pode apagar este arquivo depois de rodar.
 */
import { prisma } from "../src/utils/db";

const r = await prisma.customPlan.deleteMany();
console.log(`Apagou ${r.count} planos custom antigos.`);
await prisma.$disconnect();
