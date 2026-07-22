import { auth, signOut } from "@/auth";

// Server component: shows the signed-in user + a sign-out. Renders nothing when
// there's no session (e.g. before the gate is enforced).
export async function UserMenu() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
      className="flex items-center gap-2"
    >
      <span className="text-xs hidden sm:inline" style={{ color: "#A9CCE8" }}>{email}</span>
      <button type="submit" className="px-3 py-1.5 rounded-md text-xs font-semibold border" style={{ borderColor: "#A9CCE8", color: "#fff" }}>
        Sign out
      </button>
    </form>
  );
}
