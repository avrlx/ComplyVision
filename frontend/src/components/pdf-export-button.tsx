"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { CanonicalReport } from "@/types/report";
export function PdfExportButton({ report }: { report: CanonicalReport }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    if (busy) return;
    setBusy(true); setError("");
    try { await (await import("@/lib/report-pdf")).downloadCompliancePdf(report); }
    catch { setError("PDF export failed. Please retry or export JSON."); }
    finally { setBusy(false); }
  }
  return <span className="inline-flex flex-col gap-1"><Button variant="outline" className="bg-white text-slate-900" disabled={busy} onClick={() => void download()}>{busy ? "Creating PDF…" : "Export PDF"}</Button>{error && <span role="alert" className="max-w-60 text-xs">{error}</span>}</span>;
}
