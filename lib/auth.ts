/**
 * NextAuth (Auth.js) configuration — the single source of truth for who is
 * signed in and what role/status they have, everywhere in the app.
 *
 * Session strategy is JWT (not database sessions): the token itself carries
 * `role`, `status`, and `mustChangePassword`, so most requests can check
 * authorization without a DB round trip. The one place that *does* re-read
 * the database is the `jwt` callback's `trigger === "update"` branch (see
 * below), used after an admin approves a pending account or a user changes
 * their password, so the change takes effect without forcing a full re-login.
 *
 * Route protection itself lives in `proxy.ts`, not here — but note that
 * `proxy.ts` deliberately does not cover `/api/*`, so every API route calls
 * `auth()` (exported from this file) itself to check role/status.
 */
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";

// Distinct CredentialsSignin subclasses so the login form can tell *why*
// sign-in failed (as `error.code` on the client) and show the right
// message, instead of one generic "invalid credentials" for every case —
// a wrong password looks very different to the user than "your account is
// still awaiting admin approval".
class UnverifiedEmailError extends CredentialsSignin {
  code = "email-unverified";
}
class PendingApprovalError extends CredentialsSignin {
  code = "account-pending";
}
class RejectedAccountError extends CredentialsSignin {
  code = "account-rejected";
}

// NextAuth's built-in Session/User types don't know about this app's custom
// fields (role, status, mustChangePassword) — extend them here so the rest
// of the codebase gets type-checked access instead of casting to `any`
// everywhere a session is read.
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
      // Checked in order: bad/missing credentials fail silently (return
      // null — NextAuth turns that into a generic "invalid credentials"),
      // but once the password is confirmed correct, account-state problems
      // throw a specific error instead, so the user knows their password
      // was right and the issue is something else (unverified email,
      // pending admin approval, or a rejected registration).
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
        // Catch-all for any other non-ACTIVE status added later — fails
        // closed (generic denial) rather than silently letting them in.
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
    // Runs on sign-in (`user` present — copy the fields from authorize()
    // into the token) and whenever the client calls `update()` (`trigger
    // === "update"` — re-read the user's current status/mustChangePassword
    // from the database). That second path is what lets "admin approved
    // your account" or "you just changed your password" take effect
    // immediately, without the user having to sign out and back in — the
    // JWT would otherwise keep serving its stale values for the rest of
    // the session lifetime.
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
    // Copies the token's custom fields onto the session object returned to
    // the client/server components — this is what makes `session.user.role`
    // etc. actually available wherever `auth()` is called.
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
    // A single shared login page for all three roles (admin/teacher/student
    // each has their own sub-route/form under it) rather than NextAuth's default.
    signIn: "/login",
  },
  // JWT, not database sessions — see the file header for why.
  session: { strategy: "jwt" },
});
