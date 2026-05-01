import z from "zod";

export const schemaForgotPassword = z.object({
  email: z.email("Digite um e-mail válido"),
});

export type SchemaForgotPassword = z.infer<typeof schemaForgotPassword>;
