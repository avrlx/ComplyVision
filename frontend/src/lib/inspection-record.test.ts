import { describe, expect, it } from "vitest";

import { productName } from "@/lib/inspection-record";
import { reportFixture } from "@/test/report-fixture";

describe("productName", () => {
  it("prefers the full backend product_name over the commodity field", () => {
    const report = reportFixture();
    report.extracted_fields.product = {
      field_name: "product",
      present: true,
      normalized_value: { value: "Body Lotion" },
      issues: [],
    };
    report.extracted_fields.product_name = {
      field_name: "product_name",
      present: true,
      normalized_value: { value: "Cocoa Butter Intensive Serum Body Lotion" },
      issues: [],
    };

    expect(productName(report)).toBe("Cocoa Butter Intensive Serum Body Lotion");
  });
});
