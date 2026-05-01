import Elysia from "elysia";
import { prisma } from "@/utils/db";
import { auth } from "@/utils/auth";
import { createAuditLog } from "@/utils/auditLog";

// ─── Deriva model Prisma a partir do segmento de rota ────────────────────────

function singularize(word: string): string {
  if (word.endsWith("oes")) return `${word.slice(0, -3)}ao`; // configuracoes → configuracao
  if (word.endsWith("aes")) return `${word.slice(0, -3)}ao`; // informacoes → informacao
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1); // tipos → tipo
  return word;
}

function routeToModelName(resource: string): string | null {
  // "tipos-veiculo" → ["tipos", "veiculo"]
  const parts = resource.split("-");

  const tryModel = (name: string): boolean => {
    const model = (prisma as unknown as Record<string, unknown>)[name];
    return !!model && typeof (model as Record<string, unknown>).findUnique === "function";
  };

  // camelCase helper
  const toCamel = (ps: string[]) =>
    ps.map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1))).join("");

  // Estratégia 1: singulariza só a primeira parte — cobre "tipos-veiculo" → "tipoVeiculo"
  const s1 = toCamel([singularize(parts[0]), ...parts.slice(1)]);
  if (tryModel(s1)) return s1;

  // Estratégia 2: singulariza todas as partes — cobre "unidades-medida" → "unidadeMedida"
  const s2 = toCamel(parts.map(singularize));
  if (tryModel(s2)) return s2;

  // Estratégia 3: camelCase sem singularizar — rota já no singular
  const s3 = toCamel(parts);
  if (tryModel(s3)) return s3;

  return null;
}

// Armazena o estado anterior por request (antes do update/delete)
const beforeState = new WeakMap<Request, Record<string, unknown>>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SENSITIVE_KEYS = new Set(["password", "senha", "token", "secret", "hash", "key", "cpf"]);

// Campos prioritários por recurso (apenas os não-convencionais)
const RESOURCE_LABEL_FIELDS: Record<string, string[]> = {
  admin: ["name", "email"],
};
// Fallback: campos comuns que cobrem a maioria dos novos recursos automaticamente
const COMMON_LABEL_FIELDS = ["nome", "name", "titulo", "descricao", "email"];

function extractLabel(resource: string, record: Record<string, unknown>): string | null {
  const fields = [...(RESOURCE_LABEL_FIELDS[resource] ?? []), ...COMMON_LABEL_FIELDS];
  for (const f of fields) {
    if (record[f] != null && record[f] !== "") return String(record[f]);
  }
  return null;
}

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => sanitize(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? "[REDACTED]" : sanitize(v, depth + 1);
  }
  return out;
}

function parsePathname(pathname: string): { resource: string; resourceId: string } {
  const segs = pathname.replace(/^\//, "").split("/").filter(Boolean);
  const resource = segs[0] ?? "unknown";
  const maybeId = segs[1] ?? "";
  const resourceId = /^[a-z0-9]{20,}$/i.test(maybeId) ? maybeId : "";
  return { resource, resourceId };
}

function methodToAction(method: string, hasId: boolean): string {
  if (method === "DELETE") return "delete";
  if (method === "PUT" || method === "PATCH") return "update";
  if (method === "POST" && !hasId) return "create";
  if (method === "POST" && hasId) return "action";
  return method.toLowerCase();
}

// Resolve ElysiaCustomStatusResponse { code, response } e Promises recursivamente.
// O Elysia já resolve a Promise antes de chamar onAfterHandle, mas por segurança tratamos ambos.
async function resolveElysia(value: unknown): Promise<Record<string, unknown> | null> {
  const v = value instanceof Promise ? await value : value;
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const r = v as Record<string, unknown>;
  if (typeof r.code === "number" && "response" in r) return resolveElysia(r.response);
  return r;
}

// Compara apenas as chaves do before (registro plano do DB).
// O after pode ter relações extras — são ignoradas.
function diff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, { antes: unknown; depois: unknown }> {
  const changes: Record<string, { antes: unknown; depois: unknown }> = {};
  for (const key of Object.keys(before)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) continue;
    const a = before[key];
    const b = after[key];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      changes[key] = { antes: a, depois: b };
    }
  }
  return changes;
}

async function fetchRecord(resource: string, id: string): Promise<Record<string, unknown> | null> {
  const modelName = routeToModelName(resource);
  if (!modelName) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = (prisma as any)[modelName] as { findUnique?: (args: unknown) => Promise<unknown> } | undefined;
  if (!model?.findUnique) return null;
  const record = await model.findUnique({ where: { id } }).catch(() => null);
  return record as Record<string, unknown> | null;
}

// ─── Plugin ──────────────────────────────────────────────────────────────────

export const auditPlugin = new Elysia({ name: "Audit Plugin" })

  .onBeforeHandle({ as: "global" }, async ({ request }) => {
    const method = request.method;
    if (method !== "PUT" && method !== "PATCH" && method !== "DELETE") return;

    const pathname = new URL(request.url).pathname;
    if (pathname.startsWith("/api/auth") || pathname.startsWith("/files")) return;

    const { resource, resourceId } = parsePathname(pathname);
    if (!resourceId) return;

    const record = await fetchRecord(resource, resourceId);
    if (record) beforeState.set(request, record);
  })

  .onAfterHandle({ as: "global" }, (ctx) => {
    void (async () => {
      try {
        const { request, response } = ctx as { request: Request; response: unknown; body?: unknown };
        const method = request.method;

        if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;

        const url = new URL(request.url);
        const pathname = url.pathname;
        if (pathname.startsWith("/api/auth") || pathname.startsWith("/files")) return;

        const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
        if (!session) return;

        const { resource, resourceId } = parsePathname(pathname);
        const action = methodToAction(method, !!resourceId);

        // Desempacota a resposta do Elysia (resolve Promise + unwrap { code, response })
        const resolved = await resolveElysia(response);

        // ID final: path param ou campo id da resposta desempacotada (creates)
        let entityId = resourceId;
        if (!entityId && resolved && "id" in resolved) {
          entityId = String(resolved.id);
        }

        const before = beforeState.get(request);
        beforeState.delete(request);

        // after = resposta já resolvida pelo Elysia (contém os dados atualizados)
        const after = before && (method === "PUT" || method === "PATCH") ? resolved : null;

        const changes = before && after ? diff(before, after) : null;

        const body = (ctx as { body?: unknown }).body;

        // Extrai label do registro para exibição nos logs (sem precisar de mapeamento no frontend)
        const labelSource = before ?? (resolved ?? undefined);
        const _label = labelSource ? extractLabel(resource, labelSource) : null;

        const metadata = JSON.parse(
          JSON.stringify({
            path: pathname,
            method,
            ...(_label ? { _label } : {}),
            ...(changes && Object.keys(changes).length > 0 ? { alteracoes: changes } : {}),
            ...(body && !changes && method !== "DELETE" ? { body: sanitize(body) } : {}),
            ...(before && method === "DELETE" ? { registroRemovido: sanitize(before) } : {}),
          }),
        );

        const ip =
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
        const userAgent = request.headers.get("user-agent") ?? undefined;

        await createAuditLog({
          userId: session.user.id,
          action,
          resource,
          resourceId: entityId || pathname,
          metadata,
          ip,
          userAgent,
        });
      } catch {
        // Nunca quebra a resposta por falha de audit
      }
    })();
  });
