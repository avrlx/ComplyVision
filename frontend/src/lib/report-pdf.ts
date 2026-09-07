import { jsPDF } from "jspdf";
import type { CanonicalReport } from "@/types/report";

/** Read-only export: statuses and evidence are copied verbatim, never reevaluated. */
export function createCompliancePdf(report: CanonicalReport, fontBase64: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true, putOnlyUsedFonts: true });
  doc.addFileToVFS("DejaVuSans.ttf", fontBase64);
  doc.addFont("DejaVuSans.ttf", "Report", "normal");
  doc.setFont("Report", "normal");
  doc.setProperties({ title: "ComplyVision inspection report", subject: report.image.filename, creator: "ComplyVision" });
  const margin = 18, width = 174, bottom = 273;
  let y = 25;
  const font = doc.getFont().metadata as { characterToGlyph?: (code: number) => number };
  const safeText = (value: string) => Array.from(value).map(char => {
    const code = char.codePointAt(0)!;
    if (char === "\n" || char === "\t") return char;
    if (code < 32) return " ";
    return font.characterToGlyph?.(code) ? char : `[U+${code.toString(16).toUpperCase().padStart(4, "0")}]`;
  }).join("");
  const newPage = () => { doc.addPage(); y = 25; };
  function paragraph(value: string, size = 9, color: [number, number, number] = [40, 53, 68]) {
    doc.setFontSize(size); doc.setTextColor(...color);
    const lines = doc.splitTextToSize(safeText(value), width) as string[];
    const step = size * 0.47;
    for (const line of lines) {
      if (y + step > bottom) newPage();
      doc.text(line, margin, y); y += step;
    }
    y += 3;
  }
  function heading(value: string) {
    if (y + 23 > bottom) newPage();
    y += 4; paragraph(value, 13, [8, 65, 88]);
  }
  const scalar = (item: unknown) => typeof item === "string" ? item : JSON.stringify(item) ?? "Unavailable";
  const value = (item: unknown): string => item && typeof item === "object" && !Array.isArray(item)
    ? Object.entries(item).map(([key, entry]) => `${key.replaceAll("_", " ")}: ${scalar(entry)}`).join("\n")
    : scalar(item);
  paragraph("ComplyVision", 23, [8, 65, 88]);
  paragraph("PACKAGE INSPECTION REPORT", 10);
  paragraph(`Source: ${report.image.filename}\nProcessed: ${report.image.processing_timestamp || "Timestamp unavailable"}\nSchema: ${report.report_version}`);
  heading(`Overall status: ${report.summary.overall_status}`);
  paragraph(`PASS ${report.summary.pass_count}    FAIL ${report.summary.fail_count}    REVIEW ${report.summary.review_count}    N/A ${report.summary.not_applicable_count}`, 11);
  paragraph(report.summary.reason);
  paragraph(report.disclaimer, 9, [110, 71, 12]);
  heading("Extracted declarations");
  for (const [name, field] of Object.entries(report.extracted_fields)) {
    paragraph(`${name}: ${field.present ? "DETECTED" : "MISSING"}`, 10);
    paragraph(`Value: ${value(field.normalized_value)}\nSource text: ${field.raw_text ?? "Unavailable"}\nExtraction confidence: ${field.extraction_confidence ?? "Unavailable"}\nOCR confidence: ${field.ocr_confidence ?? "Unavailable"}`);
    if (field.issues?.length) paragraph(`Issues: ${value(field.issues)}`);
  }
  heading("Rule results");
  for (const rule of report.rule_results) {
    if (y + 28 > bottom) newPage();
    paragraph(`${rule.rule_id} - ${rule.status}`, 12, [8, 65, 88]);
    paragraph(`${rule.description}\nLegal source: ${rule.legal_source}\nApplicable: ${rule.applicable ? "Yes" : "No"}\n${rule.reason}`);
    paragraph(`Reason codes: ${rule.reason_codes.join(", ") || "None"}\nConfidence: ${rule.confidence ?? "Unavailable"}`);
    for (const evidence of rule.evidence) paragraph(value(evidence), 8);
  }
  heading("Processing notes");
  paragraph(report.warnings.length ? report.warnings.map(note => `${note.code}: ${note.message}`).join("\n") : "No processing warnings.");
  heading("Image quality and OCR");
  paragraph(value(report.quality), 8);
  const { evidence: ocrEvidence, ...ocrSummary } = report.ocr;
  paragraph(value(ocrSummary), 8);
  for (const region of ocrEvidence ?? []) paragraph(value(region), 8);
  heading("Measurements and contrast");
  for (const [name, details] of Object.entries(report.evidence)) {
    paragraph(name.replaceAll("_", " "), 10); paragraph(value(details), 8);
  }
  for (const [index, image] of (report.evidence_images ?? []).entries()) {
    // No network requests for arbitrary image URLs embedded in report data.
    if (!/^data:image\/(png|jpeg);base64,/.test(image.data_url)) throw new Error("Unsupported evidence image. Export JSON to retain the original report.");
    const properties = doc.getImageProperties(image.data_url);
    const scale = Math.min(width / properties.width, 130 / properties.height);
    const w = properties.width * scale, h = properties.height * scale;
    if (y + h + 22 + (index === 0 ? 20 : 0) > bottom) newPage();
    if (index === 0) heading("Visual evidence");
    paragraph(`${image.label} (${image.related_rule_id || image.related_declaration || image.type})`, 10);
    if (y + h > bottom) newPage();
    doc.addImage(image.data_url, properties.fileType, margin, y, w, h); y += h + 6;
  }
  paragraph("Characters unavailable in the embedded font are shown as [U+XXXX] Unicode code points. JSON export retains the original text.", 8);
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page); doc.setFontSize(8); doc.setTextColor(105, 118, 129);
    doc.text("ComplyVision | Decision support - not an official certificate", margin, 287);
    doc.text(`${page} / ${pages}`, 192, 287, { align: "right" });
  }
  return doc;
}
export async function downloadCompliancePdf(report: CanonicalReport) {
  const response = await fetch("/fonts/DejaVuSans.ttf");
  if (!response.ok) throw new Error("The PDF font could not be loaded. Please retry.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  const doc = createCompliancePdf(report, btoa(binary));
  const name = report.image.filename.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100) || "inspection";
  doc.save(`ComplyVision-${name}.pdf`);
}
