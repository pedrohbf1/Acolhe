import z from "zod";

export const schemaRegister = z
  .object({
    name: z.string().min(2, "Digite seu nome"),
    email: z.email("Digite um e-mail válido"),
    password: z.string().min(6, "Mínimo de 6 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não conferem",
  });

export type SchemaRegister = z.infer<typeof schemaRegister>;
