// NextAuth's catch-all route — handles sign-in/sign-out/session/callback
// requests for every provider configured in lib/auth.ts. Just re-exports
// the handlers NextAuth builds from that config; nothing app-specific lives here.
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
