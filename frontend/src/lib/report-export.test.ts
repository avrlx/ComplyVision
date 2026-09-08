import { describe, expect, it } from "vitest";

import { reportToJson, reportToMarkdown } from "@/lib/report-export";
import { reportFixture } from "@/test/report-fixture";

describe("report exports", () => {
  it("exports the complete canonical report as JSON", () => {
    const report = reportFixture();
    expect(JSON.parse(reportToJson(report))).toEqual(report);
  });

  it("exports a readable Markdown report without changing decisions", () => {
    const markdown = reportToMarkdown(reportFixture());
    expect(markdown).toContain("# Package Compliance Report");
    expect(markdown).toContain("| Declaration | Status | Value | Confidence |");
    expect(markdown).toContain("LM-R7-001 — REVIEW");
    expect(markdown).toContain("Legal source: Rule 7");
    expect(markdown).toContain("## Image quality");
    expect(markdown).toContain("PASS 8 · FAIL 0 · REVIEW 1 · NOT_APPLICABLE 1");
  });
});
