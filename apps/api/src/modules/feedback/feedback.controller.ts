import Elysia from "elysia";
import z from "zod";
import { betterAuthPlugin } from "@/plugins/better-openApi";
import FeedbackRepository from "./feedback.repository";
import FeedbackService from "./feedback.service";

const repository = new FeedbackRepository();
const service = new FeedbackService(repository);

const feedbackSchema = z.object({
  type: z.enum(["bug", "suggestion", "praise", "question"]),
  subject: z.string().min(3, "Assunto muito curto").max(120),
  message: z.string().min(10, "Conte um pouco mais").max(4000),
});

export const feedbackController = new Elysia({
  tags: ["Feedback"],
  prefix: "/feedback",
})
  .use(betterAuthPlugin)
  .post(
    "/",
    async ({ status, body, user }) => {
      const parsed = feedbackSchema.safeParse(body);
      if (!parsed.success) {
        return status(400, {
          error: parsed.error.issues[0]?.message ?? "Dados inválidos",
        });
      }
      try {
        await service.submit({
          ...parsed.data,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
          },
        });
        return status(200, { ok: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro ao enviar";
        console.error("[feedback] submit error:", e);
        return status(500, { error: msg });
      }
    },
    {
      auth: true,
      detail: { summary: "Envia feedback para a inbox de suporte" },
    },
  );
