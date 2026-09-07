import type { CanonicalReport, ReportStatus } from "@/types/report";
export interface InspectionRecord {
  id: string; status: ReportStatus; product_name: string | null; source_filename: string;
  report: CanonicalReport; created_at: string;
}
const statuses = new Set(["PASS", "FAIL", "REVIEW", "NOT_APPLICABLE"]);
const object = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === "object" && !Array.isArray(v));
const optional = (v: unknown, kind: "number" | "string" | "boolean") => v == null ||
  (typeof v === kind && (kind !== "number" || Number.isFinite(v)));
const strings = (v: unknown) => v == null || (Array.isArray(v) && v.every(x => typeof x === "string"));
const numericKeys = (v: Record<string, unknown>, keys: string[]) => keys.every(key => optional(v[key], "number"));
const textKeys = (v: Record<string, unknown>, keys: string[]) => keys.every(key => optional(v[key], "string"));
function validOptionalEvidence(v: Record<string, unknown>) {
  if (v.contrast != null) {
    if (!object(v.contrast) || !optional(v.contrast.threshold_basis, "string")) return false;
    if (v.contrast.targets != null && (!object(v.contrast.targets) || !Object.values(v.contrast.targets).every(target =>
      object(target) && numericKeys(target, ["contrast_ratio", "lab_color_difference"]) && textKeys(target, ["status", "ocr_text"])))) return false;
  }
  return ["numeral_height", "calibration"].every(key => v[key] == null || object(v[key]));
}
/** Validate the structures the dashboard dereferences. Do not reinterpret rule outcomes. */
export function validStoredReport(v: unknown): v is CanonicalReport {
  if (!object(v) || typeof v.report_version !== "string" || typeof v.disclaimer !== "string" ||
    !object(v.image) || typeof v.image.filename !== "string" || !object(v.summary) ||
    !statuses.has(String(v.summary.overall_status)) || typeof v.summary.reason !== "string" ||
    !object(v.quality) || !object(v.ocr) || !object(v.evidence) || !object(v.extracted_fields) ||
    !Array.isArray(v.rule_results) || !Array.isArray(v.warnings)) return false;
  if (!numericKeys(v.quality, ["blur_score", "brightness", "glare_ratio"]) || !strings(v.quality.issues) ||
    !strings(v.quality.warnings) || !optional(v.quality.threshold_basis, "string") || !optional(v.quality.usable, "boolean") ||
    !numericKeys(v.image, ["width", "height"]) || !optional(v.image.processing_timestamp, "string") ||
    (v.image.processing_timestamp && !Number.isFinite(Date.parse(String(v.image.processing_timestamp)))) ||
    !numericKeys(v.ocr, ["filtered_item_count", "raw_item_count"]) ||
    (v.ocr.evidence != null && (!Array.isArray(v.ocr.evidence) || !v.ocr.evidence.every(item => object(item) &&
      textKeys(item, ["raw_text", "normalized_text"]) && numericKeys(item, ["confidence"])))) ||
    !validOptionalEvidence(v.evidence)) return false;
  const counts = ["pass_count", "fail_count", "review_count", "not_applicable_count"];
  if (!counts.every(key => Number.isSafeInteger(v.summary && (v.summary as Record<string, unknown>)[key]) && Number((v.summary as Record<string, unknown>)[key]) >= 0)) return false;
  return v.rule_results.every(rule => object(rule) && statuses.has(String(rule.status)) &&
    ["rule_id", "description", "field_name", "legal_source", "reason"].every(key => typeof rule[key] === "string") &&
    typeof rule.applicable === "boolean" && Array.isArray(rule.reason_codes) && rule.reason_codes.every(x => typeof x === "string") &&
    numericKeys(rule, ["confidence"]) && Array.isArray(rule.evidence) && rule.evidence.every(item => object(item) &&
      textKeys(item, ["evidence_type", "field", "raw_text", "target", "ocr_text", "measurement_status", "validation_status", "unresolved_reason"]) &&
      numericKeys(item, ["contrast_ratio", "lab_difference", "estimated_numeral_height_mm", "confidence"]))) &&
    Object.values(v.extracted_fields).every(field => object(field) && typeof field.field_name === "string" && typeof field.present === "boolean" && textKeys(field, ["raw_text"]) && numericKeys(field, ["ocr_confidence", "extraction_confidence"]) && strings(field.issues)) &&
    v.warnings.every(warning => object(warning) && typeof warning.message === "string") &&
    (v.evidence_images === undefined || (Array.isArray(v.evidence_images) && v.evidence_images.every(image => object(image) &&
      ["id", "type", "label", "mime_type", "data_url"].every(key => typeof image[key] === "string") && /^data:image\/(png|jpeg);base64,/.test(String(image.data_url)))));
}
export function productName(report: CanonicalReport): string | null {
  const value = report.extracted_fields.product?.normalized_value;
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const name = value.name ?? value.value;
    return typeof name === "string" ? name : null;
  }
  return null;
}
