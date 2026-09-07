import Link from "next/link";
import { redirect } from "next/navigation";
import { InspectorProfile } from "@/components/inspector-profile";
import { authEnabled, databaseEnabled, getAuthProviders, supabaseConfigured } from "@/lib/auth/config";
import { createClient } from "@/lib/supabase/server";
import { isVerifiedUser } from "@/lib/auth/user";
export const dynamic = "force-dynamic";
export default async function AccountPage() {
  if (!authEnabled() || !supabaseConfigured()) redirect("/");
  const { data: { user }, error } = await (await createClient()).auth.getUser();
  if (error || !isVerifiedUser(user)) redirect("/login");
  return <main className="mx-auto max-w-2xl space-y-5 px-6 py-12">
    <Link href="/" className="text-sky-700 underline">Back to ComplyVision</Link>
    <h1 className="text-3xl font-semibold">Inspector account</h1>
    <p>Signed in as {user.email || user.phone}</p>
    {databaseEnabled() ? <><p>Open Inspector Profile to edit your professional details and manage phone verification.</p><InspectorProfile accountId={user.id} phoneEnabled={(await getAuthProviders()).phone} /></>
      : <p>Profile editing will be available after database setup and access verification.</p>}
    <form method="post" action="/auth/signout"><button className="rounded border px-4 py-2" type="submit">Sign out</button></form>
  </main>;
}
