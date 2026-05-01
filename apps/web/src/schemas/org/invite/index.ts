import z from "zod";

export const schemaInviteMember = z.object({
  email: z.email("Digite um e-mail válido"),
  role: z.enum(["owner", "user"]),
});

export type SchemaInviteMember = z.infer<typeof schemaInviteMember>;
