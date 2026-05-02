/**
 * Gera o hash argon2id da passphrase e GRAVA direto em
 * `apps/api/.admin-passphrase-hash` (gitignored, permissão 0600).
 *
 * Não precisa copy-paste no `.env` — evita os problemas de expansão de
 * variável que o dotenv faz com `$argon2id`, `$v=19` etc.
 *
 * Uso:
 *   bun run scripts/password-admin/hash.ts "trovao-navalha-..."
 *
 * Ou via stdin (não fica no histórico):
 *   echo "minha_passphrase" | bun run scripts/password-admin/hash.ts -
 *
 * Atenção: a passphrase em si NÃO é gravada. Salve no 1Password antes.
 */
import { writeFileSync, chmodSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf-8").trim();
}

let passphrase = process.argv[2];

if (passphrase === "-") {
  passphrase = await readStdin();
}

if (!passphrase) {
  console.error(
    "Uso:\n  bun run scripts/password-admin/hash.ts <passphrase>\nOu:\n  echo <passphrase> | bun run scripts/password-admin/hash.ts -",
  );
  process.exit(1);
}

if (passphrase.length < 12) {
  console.error("Passphrase muito curta. Use ao menos 12 caracteres.");
  process.exit(1);
}

const hash = await Bun.password.hash(passphrase, {
  algorithm: "argon2id",
  memoryCost: 19456,
  timeCost: 2,
});

// Path absoluto pra apps/api/keys/admin-passphrase-hash, independente de onde rodou
const apiRoot = resolve(import.meta.dirname, "..", "..");
const keysDir = join(apiRoot, "keys");
const target = join(keysDir, "admin-passphrase-hash");

// Garante que apps/api/keys/ existe
mkdirSync(keysDir, { recursive: true });

writeFileSync(target, hash + "\n", { encoding: "utf-8" });

// Permissão restrita (Unix). No Windows é no-op mas não falha.
try {
  chmodSync(target, 0o600);
} catch {
  // Windows ignora chmod
}

console.log("\nHash gravado em:");
console.log("  " + target);
console.log("\nPróximos passos:");
console.log("  1. Reinicie a API (Ctrl+C no `bun dev`, depois `bun dev` de novo).");
console.log("  2. Acesse /__acolhe-master e digite a passphrase original.");
console.log("  3. Limpe o terminal: Clear-Host\n");
console.log(
  "Note: este arquivo é gitignored e nunca vai pro repo. " +
    "Para rotacionar, é só rodar de novo com a nova passphrase.",
);
