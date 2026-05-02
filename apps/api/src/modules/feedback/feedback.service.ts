import {
  sendFeedbackEmail,
  sendFeedbackThankYouEmail,
} from "@/utils/email";
import { env } from "@/config/env";
import FeedbackRepository, { type FeedbackFilters } from "./feedback.repository";

export interface FeedbackInput {
  type: "bug" | "suggestion" | "praise" | "question";
  subject: string;
  message: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

const TYPE_LABELS: Record<FeedbackInput["type"], string> = {
  bug: "Bug",
  suggestion: "Sugestão",
  praise: "Elogio",
  question: "Dúvida",
};

export default class FeedbackService {
  constructor(private repository: FeedbackRepository) {}

  /**
   * Persiste o feedback no banco e dispara dois e-mails:
   *   1. Para a inbox do dono (FEEDBACK_TO_EMAIL) — com replyTo do usuário
   *   2. Para o usuário (agradecimento)
   *
   * Se a persistência falhar, joga e o front mostra erro.
   * Se um dos e-mails falhar, NÃO joga — o feedback ficou salvo e o admin verá
   * no painel. Logamos pra investigar depois.
   */
  async submit(input: FeedbackInput) {
    const typeLabel = TYPE_LABELS[input.type];

    // Persistência primeiro — se isso falhar, dá erro real pra UI.
    const feedback = await this.repository.create({
      userId: input.user.id,
      type: input.type,
      subject: input.subject,
      message: input.message,
    });

    // E-mails depois — best-effort, não bloqueiam o sucesso da operação.
    await Promise.allSettled([
      sendFeedbackEmail({
        to: env.FEEDBACK_TO_EMAIL,
        fromUserName: input.user.name,
        fromUserEmail: input.user.email,
        type: typeLabel,
        subject: input.subject,
        message: input.message,
      }).catch((e) => {
        console.error("[feedback] falha no e-mail pro admin:", e);
        throw e;
      }),
      sendFeedbackThankYouEmail({
        to: input.user.email,
        userName: input.user.name,
        type: typeLabel,
        subject: input.subject,
      }).catch((e) => {
        console.error("[feedback] falha no e-mail de agradecimento:", e);
        throw e;
      }),
    ]);

    return feedback;
  }

  list(filters: FeedbackFilters) {
    return this.repository.findAll(filters);
  }

  updateStatus(id: string, status: string, adminNote?: string) {
    return this.repository.updateStatus(id, status, adminNote);
  }
}
