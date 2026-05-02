/**
 * Sessão "master" do painel super_admin.
 *
 * Camadas de defesa:
 * 1. Usuário precisa estar autenticado (better-auth session).
 * 2. user.role === "super_admin" no banco (setado manualmente — nunca via UI).
 * 3. Após autenticar, precisa "destrancar" o painel digitando a passphrase mestre.
 *    A passphrase é validada contra `Bun.password.verify(input, env.ADMIN_PASSPHRASE_HASH)`.
 * 4. Após validar, este módulo emite um cookie HMAC-assinado (`acolhe_master`)
 *    com TTL curto (60 min). O guard checa o cookie em todas as requisições do
 *    /admin/* — sem ele, mesmo super_admin não passa.
 *
 * Esse padrão impede:
 *   - cookie de sessão roubado: o atacante não tem a passphrase
 *   - banco vazado: o hash da passphrase não roda offline em tempo viável (argon2id)
 *   - replay do cookie: HMAC com expiry impede reuso
 *   - role escalation: super_admin precisa ser setado direto no banco
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { env } from "@/config/env";

export const ADMIN_COOKIE = "acolhe_master";
const TTL_MS = 60 * 60 * 1000; // 60 minutos

/**
 * Caminho do arquivo onde o hash da passphrase fica armazenado.
 * Mora em `apps/api/keys/` — pasta inteira é gitignored.
 *
 * Preferimos arquivo separado em vez de .env porque:
 *   - hashes argon2id têm múltiplos `$` que o dotenv tenta expandir como variáveis
 *   - manipulação manual no .env é frágil (aspas simples, escaping)
 *   - arquivo é gitignored e tem permissão restrita
 */
const HASH_FILE = join(process.cwd(), "keys", "admin-passphrase-hash");

function loadHash(): string | null {
  if (existsSync(HASH_FILE)) {
    return readFileSync(HASH_FILE, "utf-8").trim();
  }
  // Fallback: env var (mantido pra retrocompat — não recomendado por causa do dotenv).
  return env.ADMIN_PASSPHRASE_HASH ?? null;
}

function requireSecret(): string {
  if (!env.ADMIN_SESSION_SECRET) {
    throw new Error(
      "ADMIN_SESSION_SECRET não configurado. Ver apps/api/src/config/env.ts",
    );
  }
  return env.ADMIN_SESSION_SECRET;
}

function hmac(payload: string): string {
  return createHmac("sha256", requireSecret()).update(payload).digest("hex");
}

/** Cria o token de sessão master pra um userId. */
export function signMasterToken(userId: string): {
  value: string;
  expiresAt: Date;
} {
  const expiresAt = Date.now() + TTL_MS;
  const payload = `${userId}.${expiresAt}`;
  const sig = hmac(payload);
  return { value: `${payload}.${sig}`, expiresAt: new Date(expiresAt) };
}

/** Verifica o token e devolve o userId se válido, ou null. */
export function verifyMasterToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiresAtStr, sig] = parts;
  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;

  const expected = hmac(`${userId}.${expiresAtStr}`);
  // timingSafeEqual evita ataques de timing
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;

  return userId;
}

/** Compara a passphrase digitada com o hash armazenado em arquivo. */
export async function verifyMasterPassphrase(
  input: string,
): Promise<boolean> {
  const hash = loadHash();
  if (!hash) {
    throw new Error(
      "Hash da passphrase não configurado. Rode `bun run scripts/password-admin/hash.ts <passphrase>` — o hash é gravado em apps/api/.admin-passphrase-hash automaticamente.",
    );
  }
  if (!input || input.length < 8) return false;
  try {
    return await Bun.password.verify(input, hash);
  } catch {
    return false;
  }
}
