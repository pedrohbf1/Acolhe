import { Elysia } from "elysia";
import { openapi } from "@elysiajs/openapi";
import cors from "@elysiajs/cors";

import { env } from "@/config/env";
import { rateLimitPlugin } from "@/config/rateLimit";
import { betterAuthPlugin, OpenAPI } from "@/plugins/better-openApi";
import { auditPlugin } from "@/plugins/auditPlugin";

// ─── Módulos ──────────────────────────────────────────────────────────────────
// Adicione os imports dos seus controllers aqui ↓

// ─── Rotas privadas (exigem autenticação) ─────────────────────────────────────
const privateRoutes = new Elysia()
  .use(betterAuthPlugin)
  .use(auditPlugin)
  .guard({ auth: true });
  // Adicione novos módulos aqui ↓
  // .use(meuController)

// ─── App ──────────────────────────────────────────────────────────────────────
const app = new Elysia()
  .use(cors({ origin: env.ALLOWED_ORIGINS, credentials: true }))
  .use(rateLimitPlugin)
  .use(
    openapi({
      documentation: {
        components: await OpenAPI.components,
        paths: await OpenAPI.getPaths(),
      },
    }),
  )
  .use(betterAuthPlugin)
  .get(
    "/",
    ({ status }) => status(200, { status: "Alive", date: new Date() }),
    {
      detail: { tags: ["Info"] },
    },
  )
  .get("/ping", ({ status }) => status(200, { pong: true }), {
    detail: { tags: ["Info"] },
  })
  .use(privateRoutes);

app.listen(env.PORT, ({ hostname, port }) => {
  console.log(`🦊 Elysia is running at http://${hostname}:${port}`);
});
