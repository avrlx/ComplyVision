import { validSourcePreview } from "@/lib/source-preview";
import { createClient } from "@/lib/supabase/server";
import { databaseEnabled, supabaseConfigured } from "@/lib/auth/config";
import { isVerifiedUser } from "@/lib/auth/user";
import { productName, validStoredReport } from "@/lib/inspection-record";

const fields = "id,status,product_name,source_filename,source_image_data_url,report,created_at";
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
async function authorize(request: Request) {
  if (!databaseEnabled() || !supabaseConfigured()) return json({ error: "Saved history is not enabled for this deployment." }, 503);
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !isVerifiedUser(user) || request.headers.get("X-ComplyVision-User") !== user.id) return json({ error: "Sign in again to access saved reports." }, 401);
  return { client, user };
}
export async function GET(request: Request) {
  const auth = await authorize(request);
  if (auth instanceof Response) return auth;
  const offset = Number(new URL(request.url).searchParams.get("offset") ?? 0);
  if (!Number.isSafeInteger(offset) || offset < 0) return json({ error: "Invalid history offset." }, 400);
  const { data, error } = await auth.client.from("inspections").select(fields).eq("user_id", auth.user.id)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 19);
  if (error) return json({ error: "Saved history could not be loaded. Check the database migrations and access policies." }, 503);
  if (data?.some(row => !validSourcePreview(row.source_image_data_url) || !validStoredReport(row.report) || row.status !== row.report.summary.overall_status))
    return json({ error: "Saved history contains an unsupported report. Contact the deployment administrator." }, 422);
  return json({ inspections: data ?? [], hasMore: data?.length === 20 });
}
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "Forbidden" }, 403);
  const auth = await authorize(request);
  if (auth instanceof Response) return auth;
  // Bound streamed bodies as well as Content-Length to prevent unbounded JSON allocations.
  const reader = request.body?.getReader();
  if (!reader) return json({ error: "Report is required." }, 400);
  const parts: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 20 * 1024 * 1024) { await reader.cancel(); return json({ error: "Report exceeds the 20 MB storage limit. Export it locally." }, 413); }
    parts.push(value);
  }
  let body;
  try { body = JSON.parse(await new Blob(parts as BlobPart[]).text()); }
  catch { return json({ error: "Invalid JSON report." }, 400); }
  if (!body || typeof body.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id) || !validStoredReport(body.report))
    return json({ error: "A valid inspection ID and canonical report are required." }, 400);
  if (!validSourcePreview(body.source_image_data_url) || (body.source_filename !== undefined && (typeof body.source_filename !== "string" || body.source_filename.length > 255)))
    return json({ error: "Invalid source filename or preview." }, 400);
  const row = { id: body.id, user_id: auth.user.id, report: body.report, status: body.report.summary.overall_status,
    source_filename: body.source_filename || body.report.image.filename, source_image_data_url: body.source_image_data_url ?? null, product_name: productName(body.report) };
  const { data, error } = await auth.client.from("inspections").insert(row).select(fields).single();
  if (!error) return json({ inspection: data }, 201);
  if (error.code === "23505") {
    // A retry after a lost response returns the original immutable record, never overwrites it.
    const existing = await auth.client.from("inspections").select(fields).eq("user_id", auth.user.id).eq("id", body.id).single();
    if (!existing.error && existing.data) return json({ inspection: existing.data });
  }
  return json({ error: "Report not saved. Check the database setup or retry; your report remains available in this page." }, 503);
}
