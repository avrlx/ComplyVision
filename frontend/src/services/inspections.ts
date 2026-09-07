import type { InspectionRecord } from "@/lib/inspection-record";
async function result(response: Response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Saved history is unavailable.");
  return body;
}
export async function loadInspections(userId: string, offset = 0): Promise<{ inspections: InspectionRecord[]; hasMore: boolean }> {
  return result(await fetch(`/api/inspections?offset=${offset}`, { cache: "no-store", headers: { "X-ComplyVision-User": userId } }));
}
export async function saveInspection(record: InspectionRecord, userId: string): Promise<InspectionRecord> {
  const body = await result(await fetch("/api/inspections", {
    method: "POST", headers: { "Content-Type": "application/json", "X-ComplyVision-User": userId }, body: JSON.stringify({ id: record.id, report: record.report }),
  }));
  return body.inspection;
}
