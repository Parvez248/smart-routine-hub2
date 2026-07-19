import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";

class UnverifiedEmailError extends CredentialsSignin {
  code = "email-unverified";
}
class PendingApprovalError extends CredentialsSignin {
  code = "account-pending";
}
class RejectedAccountError extends CredentialsSignin {
  code = "account-rejected";
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: string;
      status: string;
      mustChangePassword: boolean;
    };
  }
  interface User {
    role?: string;
    status?: string;
    mustChangePassword?: boolean;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const db = getDb();
        const user = await db.user.findUnique({ where: { email } });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        if (!user.emailVerified) throw new UnverifiedEmailError();
        if (user.status === "PENDING") throw new PendingApprovalError();
        if (user.status === "REJECTED") throw new RejectedAccountError();
        if (user.status !== "ACTIVE") return null;

        return {
          id: String(user.id),
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        (token as Record<string, unknown>).role = user.role;
        (token as Record<string, unknown>).status = user.status;
        (token as Record<string, unknown>).mustChangePassword = user.mustChangePassword;
      }
      if (trigger === "update" && token.id) {
        const db = getDb();
        const fresh = await db.user.findUnique({ where: { id: Number(token.id) } });
        if (fresh) {
          (token as Record<string, unknown>).status = fresh.status;
          (token as Record<string, unknown>).mustChangePassword = fresh.mustChangePassword;
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as unknown as Record<string, unknown>).role = (token as Record<string, unknown>).role;
        (session.user as unknown as Record<string, unknown>).status = (token as Record<string, unknown>).status;
        session.user.mustChangePassword = Boolean((token as Record<string, unknown>).mustChangePassword);
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
});
