// lib/auth.ts
// NextAuth configuration.
//
// Strategy: JWT (no DB session table — sessions live in encrypted cookies).
// Provider: Credentials (email + password with bcryptjs hashing).
// First-run: first login auto-creates the user and a default workspace.
//
// Environment variables required:
//   NEXTAUTH_SECRET  — random secret string (required)
//   NEXTAUTH_URL     — canonical app URL (required in production)

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.toLowerCase().trim();

        // Registration is handled on /register. Login only authenticates.
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        if (!user.passwordHash) return null;
        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        // Ensure the user has a workspace (safety net for edge cases).
        let membership = await prisma.workspaceMembership.findFirst({
          where: { userId: user.id },
          include: { workspace: true },
        });

        if (!membership) {
          const workspace = await prisma.workspace.create({
            data: { name: "My Workspace" },
          });
          membership = await prisma.workspaceMembership.create({
            data: { userId: user.id, workspaceId: workspace.id, role: "owner" },
            include: { workspace: true },
          });
        }

        return {
          id:            user.id,
          email:         user.email,
          name:          user.name ?? null,
          workspaceId:   membership.workspaceId,
          workspaceName: membership.workspace.name,
        };
      },
    }),
  ],

  session: { strategy: "jwt" },

  pages: {
    signIn: "/login",
  },

  callbacks: {
    // Store extra fields in the JWT on sign-in.
    async jwt({ token, user }) {
      if (user) {
        token.id            = user.id;
        token.workspaceId   = (user as AuthUser).workspaceId;
        token.workspaceName = (user as AuthUser).workspaceName;
      }
      return token;
    },

    // Expose those fields on the session object (readable by useSession / getServerSession).
    async session({ session, token }) {
      session.user.id            = token.id            as string;
      session.user.workspaceId   = token.workspaceId   as string | null | undefined;
      session.user.workspaceName = token.workspaceName as string | null | undefined;
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};

// Internal type used to carry workspace info through the authorize → jwt pipeline.
interface AuthUser {
  id:            string;
  email:         string;
  name:          string | null;
  workspaceId:   string;
  workspaceName: string;
}
