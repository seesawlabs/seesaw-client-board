export { auth as middleware } from "@/auth";

// Protect everything except: the auth flow, the cron endpoint (own CRON_SECRET),
// the login page, and static assets. Unauthenticated users hit the `authorized`
// callback in auth.ts and get redirected to /login.
export const config = {
  matcher: ["/((?!api/auth|api/cron|login|_next/static|_next/image|favicon.ico).*)"],
};
