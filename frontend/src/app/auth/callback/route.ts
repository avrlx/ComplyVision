import { NextResponse } from "next/server";
import { authEnabled, supabaseConfigured } from "@/lib/auth/config";
import { createClient } from "@/lib/supabase/server";
import { isVerifiedUser } from "@/lib/auth/user";
const redirect = (url: URL) => NextResponse.redirect(url, { status: 303, headers: { "Cache-Control": "private, no-store" } });
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next") === "/account" ? "/account" : "/";
  if (!authEnabled() || !supabaseConfigured()) return redirect(new URL("/", url));
  const code = url.searchParams.get("code");
  if (code) {
    const { data, error } = await (await createClient()).auth.exchangeCodeForSession(code);
    if (!error && isVerifiedUser(data.user)) return redirect(new URL(next, url));
  }
  return redirect(new URL("/login?error=verification_failed", url));
}
