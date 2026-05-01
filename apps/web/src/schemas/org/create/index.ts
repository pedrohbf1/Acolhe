import z from "zod";

export const schemaCreateOrganization = z.object({
  name: z.string().min(2, "Digite o nome da organização"),
  slug: z
    .string()
    .min(2, "Slug muito curto")
    .regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífens"),
});

export type SchemaCreateOrganization = z.infer<typeof schemaCreateOrganization>;
