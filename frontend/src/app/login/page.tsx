import Link from "next/link";
import { LoginForm } from "@/components/login-form";
import { authEnabled, getAuthProviders } from "@/lib/auth/config";
export const dynamic = "force-dynamic";
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
    <h1 className="text-3xl font-semibold">ComplyVision</h1>
    <p className="mb-8 mt-2 text-sm text-slate-500">Sign in to your inspection workspace.</p>
    {error === "verification_failed" && <p role="alert" className="mb-4 text-sm text-red-700">This email link is invalid or expired. Request a new sign-in email and open it in the same browser.</p>}
    {authEnabled() ? <LoginForm providers={await getAuthProviders()} /> : <p>Authentication is not enabled for this deployment. <Link className="underline" href="/">Open the session workspace</Link>.</p>}
  </main>;
}
