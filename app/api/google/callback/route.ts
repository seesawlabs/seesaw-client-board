import { NextResponse } from "next/server";
import { exchangeCode } from "@/lib/google";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const err = url.searchParams.get("error");
  if (err || !code) return NextResponse.redirect(`${url.origin}/?google=error`);
  const redirectUri = `${url.origin}/api/google/callback`;
  try {
    await exchangeCode(code, redirectUri);
    return NextResponse.redirect(`${url.origin}/?google=connected`);
  } catch {
    return NextResponse.redirect(`${url.origin}/?google=error`);
  }
}
