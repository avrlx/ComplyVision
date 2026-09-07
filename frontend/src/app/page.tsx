import { redirect } from "next/navigation";
import { AnalysisWorkspace } from "@/components/analysis-workspace";
import { authEnabled, databaseEnabled, supabaseConfigured } from "@/lib/auth/config";
import { createClient } from "@/lib/supabase/server";
import { isVerifiedUser } from "@/lib/auth/user";
export const dynamic = "force-dynamic";
export default async function Home() {
  if (!authEnabled()) return <AnalysisWorkspace />;
  if (!supabaseConfigured()) return <p>ComplyVision authentication needs configuration.</p>;
  const { data: { user }, error } = await (await createClient()).auth.getUser();
  if (error || !isVerifiedUser(user)) redirect("/login");
  let name = user.email || user.phone || "Signed in";
  if (databaseEnabled()) {
    const { data: profile } = await (await createClient()).from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    if (typeof profile?.full_name === "string" && profile.full_name.trim()) name = profile.full_name;
  }
  return <AnalysisWorkspace accountId={user.id} account={name} persistenceEnabled={databaseEnabled()} />;
}
