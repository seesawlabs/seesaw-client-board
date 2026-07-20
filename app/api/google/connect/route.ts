import { NextResponse } from "next/server";
import { authUrl, googleConfigured } from "@/lib/google";

export async function GET(req: Request) {
  if (!googleConfigured()) {
    return new NextResponse("Google integration isn't configured yet (missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).", { status: 503 });
  }
  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/api/google/callback`;
  const state = Math.random().toString(36).slice(2);
  return NextResponse.redirect(authUrl(redirectUri, state));
}
