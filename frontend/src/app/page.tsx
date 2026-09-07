import { redirect } from "next/navigation";

import { AnalysisWorkspace } from "@/components/analysis-workspace";
import { authEnabled, databaseEnabled, supabaseConfigured } from "@/lib/auth/config";
import { isVerifiedUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  if (!authEnabled()) return <AnalysisWorkspace />;
  if (!supabaseConfigured()) redirect("/login");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isVerifiedUser(user)) {
    redirect("/login");
  }

  return <AnalysisWorkspace accountId={user.id} persistenceEnabled={databaseEnabled()} />;
}
