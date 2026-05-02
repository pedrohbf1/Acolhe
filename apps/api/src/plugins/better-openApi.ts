import Elysia from "elysia";
import { auth } from "@/utils/auth";
import { ADMIN_COOKIE, verifyMasterToken } from "@/utils/admin-session";

export const betterAuthPlugin = new Elysia({ name: "Better Auth" })
  .mount(auth.handler)
  .macro({
    auth: {
      async resolve({ status, request: { headers } }) {
        const session = await auth.api.getSession({ headers });

        if (!session) {
          return status(401, { message: "Unauthorized" });
        }

        return {
          user: session.user,
          session: session.session,
        };
      },
    },
    admin: {
      async resolve({ status, request: { headers } }) {
        const session = await auth.api.getSession({ headers });

        if (!session) {
          return status(401, { message: "Unauthorized" });
        }

        const role = session.user.role;

        if (role != "admin") {
          return status(401, { message: "Unauthorized" });
        }

        return {
          user: session.user,
          session: session.session,
        };
      },
    },
    /**
     * Guard pro painel super-admin (rotas /admin/*).
     *
     * Triplo check:
     *   1. session válida
     *   2. user.role === "super_admin"
     *   3. cookie `acolhe_master` (HMAC) presente e válido pra esse userId
     *
     * Status genérico (404) pra rotas /admin sem unlock — disfarça que existe.
     * Status 423 (Locked) pra super_admin sem cookie — sinaliza pra UI pedir passphrase.
     */
    superAdmin: {
      async resolve({ status, request: { headers }, cookie }) {
        const session = await auth.api.getSession({ headers });

        if (!session) return status(404, { message: "Not Found" });

        if (session.user.role !== "super_admin") {
          return status(404, { message: "Not Found" });
        }

        const token = cookie[ADMIN_COOKIE]?.value;
        const tokenUserId = verifyMasterToken(token);

        if (!tokenUserId || tokenUserId !== session.user.id) {
          return status(423, { message: "Locked", needsUnlock: true });
        }

        return {
          user: session.user,
          session: session.session,
        };
      },
    },
  });

let _schema: ReturnType<typeof auth.api.generateOpenAPISchema>;
const getSchema = async () => (_schema ??= auth.api.generateOpenAPISchema());

export const OpenAPI = {
  getPaths: (prefix = "/api/auth") =>
    getSchema().then(({ paths }) => {
      const reference: typeof paths = Object.create(null);

      for (const path of Object.keys(paths)) {
        const key = prefix + path;
        reference[key] = paths[path];

        for (const method of Object.keys(paths[path])) {
          const operation = (reference[key] as any)[method];
          operation.tags = ["Better Auth"];
        }
      }

      return reference;
    }) as Promise<any>,
  components: getSchema().then(({ components }) => components) as Promise<any>,
} as const;
