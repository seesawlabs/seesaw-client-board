import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// Company-wide gate: anyone with a @seesawlabs.com Google account may sign in;
// everyone shares the same board (no roles). Reuses the existing Google OAuth
// client (GOOGLE_CLIENT_ID/SECRET). JWT sessions so the middleware runs on Edge.
const ALLOWED_DOMAIN = "seesawlabs.com";
const emailAllowed = (email?: string | null) => !!email && email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // hd hints Google to show only workspace accounts; we still enforce below.
      authorization: { params: { hd: ALLOWED_DOMAIN, prompt: "select_account" } },
    }),
  ],
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    // block anyone outside the domain from completing sign-in
    signIn({ profile }) {
      return emailAllowed(profile?.email as string | undefined);
    },
    // used by the middleware. Gated by AUTH_ENFORCED so we can deploy the auth
    // code, register the OAuth redirect URI, and verify login BEFORE the gate
    // goes live — flip AUTH_ENFORCED=true to enforce (no lockout window).
    authorized({ auth }) {
      if (process.env.AUTH_ENFORCED !== "true") return true;
      return emailAllowed(auth?.user?.email);
    },
  },
});
