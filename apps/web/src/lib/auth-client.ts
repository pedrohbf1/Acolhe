import { createAuthClient } from "better-auth/react";
import {
  adminClient,
  organizationClient,
} from "better-auth/client/plugins";
import { stripeClient } from "@better-auth/stripe/client";

import { ac, roles } from "./permissions";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL,
  basePath: `/${import.meta.env.VITE_AUTH_BASE_URL ?? "auth"}`,
  plugins: [
    adminClient(),
    organizationClient({
      ac,
      roles,
      dynamicAccessControl: { enabled: true },
    }),
    stripeClient({ subscription: true }),
  ],
});
