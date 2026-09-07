"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isVerifiedUser } from "@/lib/auth/user";
import type { AuthProviders } from "@/lib/auth/config";
import { Button } from "@/components/ui/button";

export function LoginForm({ providers }: { providers: AuthProviders }) {
  const router = useRouter();
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [contact, setContact] = useState("");
  const [token, setToken] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  const enabled = providers[method] && !providers.unavailable;
  const normalized = method === "phone" ? contact.replace(/[\s()-]/g, "") : contact.trim();
  async function sendCode(event?: FormEvent) {
    event?.preventDefault();
    if (busy || cooldown || !enabled) return;
    if (method === "phone" && !/^\+[1-9]\d{7,14}$/.test(normalized)) {
      setError("Enter a phone number with its country code, for example +919876543210."); return;
    }
    setBusy(true); setError("");
    try {
      const auth = createClient().auth;
      const options = { shouldCreateUser: false };
      const { error } = await auth.signInWithOtp(method === "phone" ? { phone: normalized, options } : { email: normalized, options: { ...options, emailRedirectTo: `${window.location.origin}/auth/callback` } });
      if (error) throw new Error("Could not send a code. Check your details, account registration, and provider setup, then try again later.");
      setSent(true); setCooldown(60);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not send a code."); }
    finally { setBusy(false); }
  }
  async function verify(event: FormEvent) {
    event.preventDefault();
    if (busy || !enabled) return;
    setBusy(true); setError("");
    try {
      const { data, error } = await createClient().auth.verifyOtp(method === "phone"
        ? { phone: normalized, token: token.trim(), type: "sms" }
        : { email: normalized, token: token.trim(), type: "email" });
      if (error || !data.session || !isVerifiedUser(data.user)) throw new Error("This code is invalid or expired. Try again or request a new code.");
      router.replace("/");
      router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Verification failed."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-5">
    {providers.unavailable && <p role="alert">Authentication is unavailable. Check the Supabase configuration and try reloading.</p>}
    <div className="flex gap-2">
      {(["email", "phone"] as const).map(value => <Button key={value} variant={method === value ? "default" : "outline"} disabled={busy || sent || !providers[value]} onClick={() => { setMethod(value); setContact(""); setError(""); }}>{value === "phone" ? "Phone OTP" : "Email sign-in"}</Button>)}
    </div>
    {!providers.phone && <p className="text-sm text-slate-500">Phone sign-in is coming soon. Use email to sign in.</p>}
    <form onSubmit={sent ? verify : sendCode} className="space-y-4">
      <label className="block text-sm">{method === "phone" ? "Phone number (with country code)" : "Email address"}<input className="mt-1 w-full rounded border p-3" type={method === "phone" ? "tel" : "email"} autoComplete={method === "phone" ? "tel" : "email"} required maxLength={254} disabled={sent || busy || !enabled} value={contact} onChange={e => setContact(e.target.value)} /></label>
      {sent && <><p className="text-sm">{method === "email" ? `Check ${contact} for a sign-in link or code. Open the link in this browser, or enter the code below.` : `Enter the code sent to ${contact}. Keep this page open.`}</p><label className="block text-sm">Verification code<input className="mt-1 w-full rounded border p-3" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6,10}" required maxLength={10} value={token} disabled={busy} onChange={e => setToken(e.target.value)} /></label></>}
      <Button className="w-full" disabled={busy || !enabled || (!sent && cooldown > 0)} type="submit">{busy ? "Please wait…" : sent ? "Verify and sign in" : method === "email" ? "Send sign-in email" : "Send code"}</Button>
      {sent && <div className="flex gap-3"><Button variant="outline" type="button" disabled={busy || cooldown > 0} onClick={() => void sendCode()}>{cooldown ? `Resend in ${cooldown}s` : "Resend code"}</Button><Button variant="outline" type="button" disabled={busy} onClick={() => { setSent(false); setToken(""); setError(""); }}>Change contact</Button></div>}
      {!sent && cooldown > 0 && <p className="text-sm">Please wait {cooldown}s before requesting another code.</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </form>
    {!providers.phone && <section className="rounded-lg border border-slate-200 bg-slate-50 p-4" aria-label="Phone sign-in coming soon"><label className="block text-sm font-medium">Phone number<input type="tel" disabled placeholder="Phone sign-in is not available yet" className="mt-2 w-full rounded border bg-slate-100 p-3 text-sm" /></label><p className="mt-2 text-xs text-slate-500">Optional phone authentication will be available later. No number is sent or saved here.</p></section>}
  </div>;
}
