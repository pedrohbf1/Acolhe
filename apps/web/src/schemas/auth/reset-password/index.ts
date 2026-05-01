import z from "zod";

export const schemaResetPassword = z
  .object({
    password: z.string().min(6, "Mínimo de 6 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não conferem",
  });

export type SchemaResetPassword = z.infer<typeof schemaResetPassword>;
