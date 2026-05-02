import z from "zod";

export const FEEDBACK_TYPES = ["bug", "suggestion", "praise", "question"] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const schemaFeedback = z.object({
  type: z.enum(FEEDBACK_TYPES),
  subject: z
    .string()
    .min(3, "Dê um assunto mais descritivo")
    .max(120, "Assunto longo demais"),
  message: z
    .string()
    .min(10, "Conte um pouco mais (10+ caracteres)")
    .max(4000, "Texto longo demais"),
});

export type SchemaFeedback = z.infer<typeof schemaFeedback>;
