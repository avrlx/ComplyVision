import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authEnabled, supabaseConfigured } from "@/lib/auth/config";
import { isVerifiedUser } from "@/lib/auth/user";

export async function proxy(request: NextRequest) {
  if (!authEnabled()) return NextResponse.next();
  if (!supabaseConfigured()) return new NextResponse("ComplyVision authentication needs configuration.", { status: 503 });
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // Verify with Auth; the page and every data route also authorize independently.
  const { data: { user }, error } = await supabase.auth.getUser();
  const authenticated = !error && isVerifiedUser(user);
  let destination: NextResponse | undefined;
  if (!authenticated && request.nextUrl.pathname === "/") {
    destination = NextResponse.redirect(new URL("/login", request.url));
  } else if (authenticated && request.nextUrl.pathname === "/login") {
    destination = NextResponse.redirect(new URL("/", request.url));
  }
  if (destination) {
    response.cookies.getAll().forEach(cookie => destination!.cookies.set(cookie));
    response = destination;
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: ["/", "/login", "/api/inspections/:path*", "/auth/signout"] };
