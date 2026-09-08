// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { createCompliancePdf } from "./report-pdf";
import { reportFixture } from "@/test/report-fixture";
const font = readFileSync(new URL("../../public/fonts/DejaVuSans.ttf", import.meta.url)).toString("base64");
it("paginates long evidence, retains all outcomes and does not mutate the report", () => {
  const report = reportFixture();
  report.evidence_images = [];
  report.rule_results[1].reason = "Measurement remains unverified. ".repeat(900) + "END_OF_LONG_REASON";
  const before = JSON.stringify(report);
  const doc = createCompliancePdf(report, font);
  expect(doc.getNumberOfPages()).toBeGreaterThan(5);
  expect(JSON.stringify(report)).toBe(before);
  const pages = (doc as unknown as { internal: { pages: string[][] } }).internal.pages;
  // Embedded TrueType fonts use glyph IDs. Check the end of a multi-page reason survives.
  const fontMetadata = doc.getFont().metadata as { characterToGlyph: (code: number) => number };
  const hex = (text: string) => Array.from(text).map(c => fontMetadata.characterToGlyph(c.charCodeAt(0)).toString(16).padStart(4, "0")).join("");
  const output = pages.flat().join("\n");
  expect(output.includes(hex("END_OF_LONG_REASON"))).toBe(true);
  expect(output.includes(hex("REVIEW"))).toBe(true);
  expect(output.includes(hex("₹145.00"))).toBe(true);
  expect(doc.output("arraybuffer").byteLength).toBeGreaterThan(10000);
});

it("retains supplied inspection metadata", () => {
  const report = reportFixture();
  const doc = createCompliancePdf(report, font, {
    inspectionId: "inspection-123",
    createdAt: "2026-09-02T00:00:00Z",
    sourceFilename: "package-front.jpg",
  });
  const pages = (doc as unknown as { internal: { pages: string[][] } }).internal.pages;
  const fontMetadata = doc.getFont().metadata as { characterToGlyph: (code: number) => number };
  const hex = (text: string) => Array.from(text).map(c => fontMetadata.characterToGlyph(c.charCodeAt(0)).toString(16).padStart(4, "0")).join("");
  const output = pages.flat().join("\n");
  expect(output).toContain(hex("inspection-123"));
  expect(output).toContain(hex("package-front.jpg"));
});
