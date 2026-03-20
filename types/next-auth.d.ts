// types/next-auth.d.ts
// Augment NextAuth session and JWT types to include workspace fields.

import type { DefaultSession, DefaultUser } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id:             string;
      workspaceId?:   string | null;
      workspaceName?: string | null;
    } & DefaultSession["user"];
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface User extends DefaultUser {
    workspaceId?:   string | null;
    workspaceName?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id?:            string;
    workspaceId?:   string | null;
    workspaceName?: string | null;
  }
}
