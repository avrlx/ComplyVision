import { jsPDF } from "jspdf";

import type { CanonicalReport, JsonValue, ReportStatus } from "@/types/report";

type Color = [number, number, number];

function display(value: JsonValue | undefined): string {
  if (value === null || value === undefined || value === "") return "Not detected";
  if (Array.isArray(value)) return value.map(display).join(", ");
  if (typeof value === "object") {
    return Object.entries(value)
      .filter(([, item]) => item !== null && item !== "")
      .map(([key, item]) => `${key.replaceAll("_", " ")}: ${display(item)}`)
      .join(" | ") || "Not detected";
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function humanize(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function safeFileName(value: string): string {
  return value.replace(/[^a-z0-9-_]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "package";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export interface PdfReportOptions {
  inspectionId?: string;
  createdAt?: string;
  sourceFilename?: string | null;
  sourceImageDataUrl?: string | null;
}

/** Read-only export: statuses and evidence are copied verbatim, never reevaluated. */
export function createCompliancePdf(report: CanonicalReport, fontBase64: string, options: PdfReportOptions = {}) {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true, putOnlyUsedFonts: true });
  doc.addFileToVFS("DejaVuSans.ttf", fontBase64);
  doc.addFont("DejaVuSans.ttf", "Report", "normal");
  doc.addFont("DejaVuSans.ttf", "Report", "bold");
  doc.setProperties({
    title: "ComplyVision inspection report",
    subject: report.image.filename,
    creator: "ComplyVision",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const footerY = pageHeight - 10;
  const contentBottom = footerY - 6;
  let y = 16;

  const palette = {
    navy: [8, 47, 73] as Color,
    blue: [14, 116, 144] as Color,
    text: [15, 23, 42] as Color,
    muted: [71, 85, 105] as Color,
    light: [241, 245, 249] as Color,
    card: [248, 250, 252] as Color,
    border: [203, 213, 225] as Color,
    white: [255, 255, 255] as Color,
    pass: [22, 101, 52] as Color,
    fail: [185, 28, 28] as Color,
    review: [146, 64, 14] as Color,
    neutral: [71, 85, 105] as Color,
  };

  doc.setFont("Report", "normal");
  const font = doc.getFont().metadata as { characterToGlyph?: (code: number) => number };
  const safeText = (value: string): string => Array.from(value).map((character) => {
    const code = character.codePointAt(0)!;
    if (character === "\n" || character === "\t") return character;
    if (code < 32) return " ";
    return font.characterToGlyph?.(code) ? character : `[U+${code.toString(16).toUpperCase().padStart(4, "0")}]`;
  }).join("");

  const setFont = (style: "normal" | "bold" = "normal") => doc.setFont("Report", style);
  const statusColor = (status: ReportStatus): Color => {
    if (status === "PASS") return palette.pass;
    if (status === "FAIL") return palette.fail;
    if (status === "REVIEW") return palette.review;
    return palette.neutral;
  };
  const statusLabel = (status: ReportStatus): string => status === "NOT_APPLICABLE" ? "N/A" : status;

  const newPage = () => {
    doc.addPage();
    y = 17;
  };

  const ensureSpace = (needed: number): boolean => {
    if (y + needed <= contentBottom) return false;
    newPage();
    return true;
  };

  const split = (text: string, width: number): string[] => doc.splitTextToSize(safeText(text.trim() || "Not detected"), width) as string[];

  const drawFooter = (page: number, pages: number) => {
    doc.setDrawColor(...palette.border);
    doc.setLineWidth(0.25);
    doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);
    setFont();
    doc.setFontSize(7.5);
    doc.setTextColor(...palette.muted);
    doc.text("ComplyVision | Legal Metrology Inspection Report | Decision support", margin, footerY + 1);
    doc.text(`Page ${page} of ${pages}`, pageWidth - margin, footerY + 1, { align: "right" });
  };

  const addParagraph = (
    text: string,
    size = 9.5,
    lineHeight = 5,
    gapAfter = 4,
    color: Color = palette.text,
  ) => {
    const lines = split(text, contentWidth);
    setFont();
    doc.setFontSize(size);
    doc.setTextColor(...color);
    for (const line of lines) {
      ensureSpace(lineHeight);
      doc.text(line, margin, y);
      y += lineHeight;
    }
    y += gapAfter;
  };

  const addSection = (title: string, subtitle?: string, minimumFollowing = 14) => {
    const subtitleLines = subtitle ? split(subtitle, contentWidth) : [];
    ensureSpace(13 + subtitleLines.length * 4.2 + (subtitle ? 4 : 0) + minimumFollowing);
    doc.setFillColor(...palette.navy);
    doc.roundedRect(margin, y, contentWidth, 9, 1.8, 1.8, "F");
    setFont("bold");
    doc.setFontSize(10);
    doc.setTextColor(...palette.white);
    doc.text(safeText(title.toUpperCase()), margin + 4, y + 6);
    y += 13;
    if (subtitle) {
      setFont();
      doc.setFontSize(8.5);
      doc.setTextColor(...palette.muted);
      doc.text(subtitleLines, margin, y);
      y += subtitleLines.length * 4.2 + 4;
    }
  };

  const addContinuationLabel = (title: string) => {
    setFont("bold");
    doc.setFontSize(8);
    doc.setTextColor(...palette.navy);
    doc.text(safeText(`${title.toUpperCase()} - CONTINUED`), margin, y);
    y += 7;
  };

  const addLabelValue = (label: string, value: string) => {
    const labelWidth = 48;
    const valueLines = split(value, contentWidth - labelWidth - 3);
    const rowHeight = Math.max(7, valueLines.length * 4.2 + 2);
    ensureSpace(rowHeight + 1);
    setFont("bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...palette.muted);
    doc.text(safeText(label), margin, y);
    setFont();
    doc.setTextColor(...palette.text);
    doc.text(valueLines, margin + labelWidth, y);
    y += rowHeight;
    doc.setDrawColor(...palette.border);
    doc.setLineWidth(0.18);
    doc.line(margin, y - 1.5, pageWidth - margin, y - 1.5);
    y += 2;
  };

  const addStatusPill = (status: ReportStatus, x: number, top: number, width = 24) => {
    doc.setFillColor(...statusColor(status));
    doc.roundedRect(x, top, width, 7, 1.8, 1.8, "F");
    setFont("bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...palette.white);
    doc.text(statusLabel(status), x + width / 2, top + 4.7, { align: "center" });
  };

  const drawCheckSegment = (
    rule: CanonicalReport["rule_results"][number],
    reasonLines: string[],
    first: boolean,
    continuedAfter: boolean,
  ) => {
    const titleLines = first ? split(rule.description, contentWidth - 38) : [safeText(`${rule.description} (continued)`)];
    const titleLineHeight = 4.7;
    const reasonLineHeight = 4.4;
    const titleHeight = titleLines.length * titleLineHeight;
    const cardHeight = 21 + titleHeight + reasonLines.length * reasonLineHeight + (continuedAfter ? 2 : 4);
    const cardTop = y;
    const titleX = margin + 5;

    doc.setFillColor(...palette.card);
    doc.setDrawColor(...palette.border);
    doc.setLineWidth(0.35);
    doc.roundedRect(margin, cardTop, contentWidth, cardHeight, 2, 2, "FD");
    doc.setFillColor(...statusColor(rule.status));
    doc.roundedRect(margin, cardTop, 2.5, cardHeight, 1.2, 1.2, "F");

    setFont("bold");
    doc.setFontSize(first ? 9.5 : 8.5);
    doc.setTextColor(...palette.text);
    doc.text(titleLines, titleX, cardTop + 7);
    if (first) addStatusPill(rule.status, pageWidth - margin - 25, cardTop + 3, 25);

    const evaluationY = cardTop + 10 + titleHeight;
    setFont("bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...palette.muted);
    doc.text(first ? "EVALUATION" : "EVALUATION - CONTINUED", titleX, evaluationY);

    setFont();
    doc.setFontSize(8.5);
    doc.setTextColor(...palette.text);
    doc.text(reasonLines, titleX, evaluationY + 5);
    y = cardTop + cardHeight + 4;
  };

  const addCheckCard = (rule: CanonicalReport["rule_results"][number]) => {
    const allReasonLines = split(rule.reason || "No additional explanation was provided.", contentWidth - 10);
    let offset = 0;
    let first = true;

    while (offset < allReasonLines.length) {
      const titleLines = first ? split(rule.description, contentWidth - 38) : [safeText(`${rule.description} (continued)`)];
      const fixedHeight = 21 + titleLines.length * 4.7 + 4;
      const minimumCardHeight = fixedHeight + 4.4;
      if (ensureSpace(minimumCardHeight) && first) addContinuationLabel("Compliance checks");
      const availableForLines = Math.max(4.4, contentBottom - y - fixedHeight);
      const lineCount = Math.max(1, Math.floor(availableForLines / 4.4));
      const chunk = allReasonLines.slice(offset, offset + lineCount);
      const continuedAfter = offset + chunk.length < allReasonLines.length;
      drawCheckSegment(rule, chunk, first, continuedAfter);
      offset += chunk.length;
      first = false;
      if (continuedAfter) newPage();
    }
  };

  doc.setFillColor(...palette.navy);
  doc.rect(0, 0, pageWidth, 34, "F");
  doc.setTextColor(...palette.white);
  setFont("bold");
  doc.setFontSize(20);
  doc.text("ComplyVision", margin, 13);
  doc.setFontSize(8.5);
  doc.text("LEGAL METROLOGY INSPECTION REPORT", margin, 19);
  setFont();
  doc.setFontSize(8);
  doc.text("See. Verify. Comply.", margin, 25);

  y = 43;
  setFont("bold");
  doc.setFontSize(18);
  doc.setTextColor(...palette.text);
  doc.text("Package Compliance Report", margin, y);
  y += 7;
  addParagraph(
    "A concise, human-readable inspection report generated from the information presented in the ComplyVision workspace.",
    8.8,
    4.3,
    5,
    palette.muted,
  );

  const overall = report.summary.overall_status;
  ensureSpace(20);
  doc.setFillColor(...palette.light);
  doc.setDrawColor(...palette.border);
  doc.roundedRect(margin, y, contentWidth, 17, 2.5, 2.5, "FD");
  setFont("bold");
  doc.setFontSize(8);
  doc.setTextColor(...palette.muted);
  doc.text("OVERALL COMPLIANCE OUTCOME", margin + 5, y + 6);
  addStatusPill(overall, pageWidth - margin - 31, y + 4.5, 31);
  y += 11;
  setFont();
  doc.setFontSize(8.5);
  doc.setTextColor(...statusColor(overall));
  doc.text(overall === "NOT_APPLICABLE" ? "NOT APPLICABLE" : overall, margin + 5, y + 1);
  y += 13;

  addSection("Inspection details", "Basic inspection information shown to the inspector in the application.", 36);
  addLabelValue("Inspection ID", options.inspectionId ?? "Not available");
  addLabelValue(
    "Inspection time",
    formatDate(options.createdAt ?? report.image.processing_timestamp),
  );
  addLabelValue("Source image", options.sourceFilename ?? report.image.filename ?? "Not available");
  addLabelValue("Image dimensions", `${report.image.width ?? "?"} x ${report.image.height ?? "?"} px`);

  if (options.sourceImageDataUrl) {
    try {
      const properties = doc.getImageProperties(options.sourceImageDataUrl);
      const maxWidth = 78;
      const maxHeight = 52;
      const scale = Math.min(maxWidth / properties.width, maxHeight / properties.height);
      const imageWidth = properties.width * scale;
      const imageHeight = properties.height * scale;
      ensureSpace(imageHeight + 12);
      doc.setDrawColor(...palette.border);
      doc.roundedRect(margin, y, imageWidth, imageHeight, 2, 2, "S");
      doc.addImage(options.sourceImageDataUrl, properties.fileType, margin, y, imageWidth, imageHeight, undefined, "FAST");
      y += imageHeight + 4;
      setFont();
      doc.setFontSize(7.5);
      doc.setTextColor(...palette.muted);
      doc.text("Package image captured during the inspection", margin, y);
      y += 7;
    } catch {
      addParagraph("The source package image could not be embedded in this PDF.", 8.5, 4.2, 3, palette.muted);
    }
  }

  addSection("Compliance summary", "A quick overview of the checks shown in the inspection report.", 32);
  const metrics = [
    ["PASS", report.summary.pass_count, palette.pass],
    ["FAIL", report.summary.fail_count, palette.fail],
    ["REVIEW", report.summary.review_count, palette.review],
    ["N/A", report.summary.not_applicable_count, palette.neutral],
  ] as const;
  const metricGap = 3;
  const metricWidth = (contentWidth - metricGap * 3) / 4;
  metrics.forEach(([label, metricValue, color], index) => {
    const x = margin + index * (metricWidth + metricGap);
    doc.setFillColor(...palette.light);
    doc.setDrawColor(...palette.border);
    doc.roundedRect(x, y, metricWidth, 21, 2, 2, "FD");
    setFont("bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...color);
    doc.text(label, x + 4, y + 6);
    doc.setFontSize(15);
    doc.text(String(metricValue), x + 4, y + 15.5);
  });
  y += 27;
  addParagraph(report.summary.reason, 9, 4.5, 2);

  addSection("Extracted declarations", "Product information is formatted as readable field/value pairs.", 18);
  const declarations = Object.values(report.extracted_fields);
  if (declarations.length === 0) {
    addParagraph("No product declarations were detected.", 9, 4.5, 2, palette.muted);
  } else {
    declarations.forEach((field) => {
      const valueLines = split(display(field.normalized_value), contentWidth - 8);
      const cardHeight = Math.max(14, 8 + valueLines.length * 4.5);
      if (ensureSpace(cardHeight + 4)) addContinuationLabel("Extracted declarations");
      doc.setFillColor(...palette.card);
      doc.setDrawColor(...palette.border);
      doc.roundedRect(margin, y, contentWidth, cardHeight, 2, 2, "FD");
      setFont("bold");
      doc.setFontSize(8);
      doc.setTextColor(...palette.blue);
      doc.text(safeText(humanize(field.field_name).toUpperCase()), margin + 4, y + 5.5);
      setFont();
      doc.setFontSize(9);
      doc.setTextColor(...palette.text);
      doc.text(valueLines, margin + 4, y + 10);
      y += cardHeight + 4;
    });
  }

  addSection("Compliance checks", "Each check uses the same status-and-evaluation style as the application.", 34);
  if (report.rule_results.length === 0) {
    addParagraph("No compliance checks are available for this inspection.", 9, 4.5, 2, palette.muted);
  } else {
    report.rule_results.forEach(addCheckCard);
  }

  if (report.warnings.length > 0) {
    addSection("Processing notes", "Warnings recorded while the package image was analyzed.", 14);
    report.warnings.forEach((warning) => addParagraph(`${warning.code}: ${warning.message}`, 8.5, 4.2, 3));
  }

  addSection("Image quality and OCR", "Supporting capture and text-recognition details.", 20);
  addParagraph(
    [
      `Image usable: ${report.quality.usable === undefined || report.quality.usable === null ? "Unknown" : report.quality.usable ? "Yes" : "No"}`,
      `Quality status: ${report.image.quality_status ?? "Unknown"}`,
      `Blur score: ${report.quality.blur_score ?? "Unknown"}`,
      `Brightness: ${report.quality.brightness ?? "Unknown"}`,
      `Glare ratio: ${report.quality.glare_ratio ?? "Unknown"}`,
      `OCR regions retained: ${report.ocr.filtered_item_count ?? "Unknown"}`,
    ].join(" | "),
    8.5,
    4.2,
    3,
  );
  for (const region of report.ocr.evidence ?? []) {
    const recognized = region.raw_text ?? region.normalized_text;
    if (recognized) {
      addParagraph(
        `Recognized text: ${recognized}${typeof region.confidence === "number" ? ` | Confidence: ${(region.confidence * 100).toFixed(1)}%` : ""}`,
        8.5,
        4.2,
        2,
        palette.muted,
      );
    }
  }

  const numeral = report.evidence.numeral_height;
  const contrastTargets = Object.entries(report.evidence.contrast?.targets ?? {});
  if (numeral || contrastTargets.length > 0) {
    addSection("Measurements and contrast", "Engineering evidence recorded for review.", 18);
    if (numeral) {
      addParagraph(
        [
          `Numeral height: ${numeral.estimated_numeral_height_mm ?? "Unknown"} mm`,
          `Measurement confidence: ${typeof numeral.measurement_confidence === "number" ? `${(numeral.measurement_confidence * 100).toFixed(1)}%` : "Unknown"}`,
          `Calibration detected: ${numeral.calibration_detected === undefined ? "Unknown" : numeral.calibration_detected ? "Yes" : "No"}`,
          `Validation: ${numeral.validation_status ?? "Unknown"}`,
        ].join(" | "),
        8.5,
        4.2,
        3,
      );
      if (numeral.unresolved_reason) addParagraph(numeral.unresolved_reason, 8.5, 4.2, 3, palette.muted);
    }
    contrastTargets.forEach(([name, target]) => addParagraph(
      `${humanize(name)}: ${target.status ?? "Unknown"} | Text: ${target.ocr_text ?? "Unknown"} | Contrast ratio: ${target.contrast_ratio ?? "Unknown"} | Lab difference: ${target.lab_color_difference ?? "Unknown"}`,
      8.5,
      4.2,
      2,
    ));
  }

  addSection("Inspector interpretation", "Important context for reading the outcome.", 24);
  addParagraph(report.disclaimer, 9, 4.5, 4);
  addParagraph(
    "This report is intended as evidence-backed decision support. A REVIEW outcome indicates that the displayed information requires additional human verification before a final compliance decision is made.",
    9,
    4.5,
    2,
    palette.muted,
  );

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    drawFooter(page, pages);
  }
  return doc;
}

export async function downloadCompliancePdf(report: CanonicalReport, options: PdfReportOptions = {}): Promise<void> {
  const response = await fetch("/fonts/DejaVuSans.ttf");
  if (!response.ok) throw new Error("The PDF font could not be loaded. Please retry.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  const doc = createCompliancePdf(report, btoa(binary), options);
  const identity = options.inspectionId ?? report.image.filename.replace(/\.[^.]+$/, "");
  doc.save(`${safeFileName(identity)}-complyvision-report.pdf`);
}
