import z from "zod";

export const schemaLogin = z.object({
    email: z.email("Digite um e-mail válido"),
    password: z.string().min(6, "Digite uma senha válida"),
    rememberMe: z.boolean().optional()
})

export type SchemaLogin = z.infer<typeof schemaLogin>
