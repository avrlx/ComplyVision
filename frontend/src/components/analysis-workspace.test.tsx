import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AnalysisWorkspace } from "@/components/analysis-workspace";
import { analyzePackage, checkHealth, loadDemoSample } from "@/services/api";
import { loadInspections, saveInspection } from "@/services/inspections";
import { reportFixture } from "@/test/report-fixture";

vi.mock("@/lib/source-preview", () => ({ createSourcePreview: vi.fn().mockResolvedValue("data:image/jpeg;base64,/9j/2Q==") }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/services/inspections", () => ({ loadInspections: vi.fn(), saveInspection: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }) } }) }));
vi.mock("@/services/api", () => ({
  analyzePackage: vi.fn(),
  checkHealth: vi.fn(),
  loadDemoSample: vi.fn(),
}));

const mockedAnalyze = vi.mocked(analyzePackage);
const mockedHealth = vi.mocked(checkHealth);
const mockedDemo = vi.mocked(loadDemoSample);

describe("AnalysisWorkspace", () => {
  beforeEach(() => {
    mockedHealth.mockResolvedValue({ status: "ok", service: "ComplyVision" });
    mockedAnalyze.mockResolvedValue(reportFixture());
    mockedDemo.mockResolvedValue(new File(["demo"], "standard-package.jpg", { type: "image/jpeg" }));
  });

  it("shows loading instead of zero counts while database history is pending", () => {
    vi.mocked(loadInspections).mockImplementation(() => new Promise(() => {}));
    render(<AnalysisWorkspace accountId="owner" persistenceEnabled />);
    expect(screen.getByText("Loading workspace data…")).toBeInTheDocument();
    expect(screen.queryByText("Total Inspections")).not.toBeInTheDocument();
  });

  it("shows database failures on the dashboard and retries the fetch", async () => {
    const user = userEvent.setup();
    vi.mocked(loadInspections).mockRejectedValueOnce(new Error("Database is unavailable."));
    render(<AnalysisWorkspace accountId="owner" persistenceEnabled />);
    expect(await screen.findByText("Database is unavailable.")).toBeInTheDocument();
    expect(screen.queryByText("Total Inspections")).not.toBeInTheDocument();
    vi.mocked(loadInspections).mockResolvedValue({ inspections: [], hasMore: false });
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Total Inspections")).toBeInTheDocument();
  });

  it("loads older database pages before calculating dashboard totals", async () => {
    const records = Array.from({ length: 21 }, (_, index) => ({
      id: `inspection-${index}`, status: "REVIEW" as const, product_name: `Product ${index}`,
      source_filename: "package.jpg", report: reportFixture(), created_at: "2026-09-07T12:00:00Z",
    }));
    vi.mocked(loadInspections)
      .mockResolvedValueOnce({ inspections: records.slice(0, 20), hasMore: true })
      .mockResolvedValueOnce({ inspections: records.slice(20), hasMore: false });
    render(<AnalysisWorkspace accountId="owner" persistenceEnabled />);
    await screen.findByText("Total Inspections");
    expect(vi.mocked(loadInspections)).toHaveBeenCalledWith("owner", 20);
    expect(screen.getByText("Total Inspections").parentElement).toHaveTextContent("21");
    expect(screen.getByText("Needs Review").parentElement).toHaveTextContent("21");
  });

  it("accepts a supported file selection and shows its metadata", async () => {
    const user = userEvent.setup();
    render(<AnalysisWorkspace />);
    await user.click(await screen.findByRole("button", { name: "Start first inspection" }));
    const file = new File([new Uint8Array(2048)], "package.jpg", { type: "image/jpeg" });

    await user.upload(screen.getByLabelText("Package image"), file);

    expect(screen.getByText("package.jpg")).toBeInTheDocument();
    expect(screen.getByText("2.0 KB")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /analyze package/i })).toBeEnabled();
  });

  it("rejects an unsupported file before upload", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<AnalysisWorkspace />);
    await user.click(await screen.findByRole("button", { name: "Start first inspection" }));

    await user.upload(screen.getByLabelText("Package image"), new File(["gif"], "package.gif", { type: "image/gif" }));

    expect(screen.getByText("Choose a JPEG, JPG, or PNG image.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /analyze package/i })).toBeDisabled();
    expect(mockedAnalyze).not.toHaveBeenCalled();
  });

  it("shows a non-streaming loading state and disables duplicate submission", async () => {
    const user = userEvent.setup();
    let resolveReport: (value: ReturnType<typeof reportFixture>) => void = () => undefined;
    mockedAnalyze.mockImplementation(() => new Promise((resolve) => { resolveReport = resolve; }));
    render(<AnalysisWorkspace />);
    await user.click(await screen.findByRole("button", { name: "Start first inspection" }));
    await user.upload(screen.getByLabelText("Package image"), new File(["jpg"], "package.jpg", { type: "image/jpeg" }));

    await user.click(screen.getByRole("button", { name: /analyze package/i }));

    expect(screen.getByText("Generating compliance report")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /analyze package/i })).not.toBeInTheDocument();
    expect(mockedAnalyze).toHaveBeenCalledTimes(1);
    resolveReport(reportFixture());
  });

  it("renders REVIEW as a valid canonical result with returned counts", async () => {
    const user = userEvent.setup();
    render(<AnalysisWorkspace />);
    await user.click(await screen.findByRole("button", { name: "Start first inspection" }));
    await user.upload(screen.getByLabelText("Package image"), new File(["jpg"], "package.jpg", { type: "image/jpeg" }));
    await user.click(screen.getByRole("button", { name: /analyze package/i }));

    expect(await screen.findByText("Overall compliance status")).toBeInTheDocument();
    expect(screen.getAllByText("REVIEW").length).toBeGreaterThan(0);
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("LM-R7-001 · Rule 7")).toBeInTheDocument();
    expect(screen.getByText("SUNLITE REFINED OIL")).toBeInTheDocument();
  });

  it("renders a sanitized analysis error with Retry", async () => {
    const user = userEvent.setup();
    mockedAnalyze.mockRejectedValue(new Error("Analysis could not be completed. Please retry."));
    render(<AnalysisWorkspace />);
    await user.click(await screen.findByRole("button", { name: "Start first inspection" }));
    await user.upload(screen.getByLabelText("Package image"), new File(["jpg"], "package.jpg", { type: "image/jpeg" }));
    await user.click(screen.getByRole("button", { name: /analyze package/i }));

    expect(await screen.findByText("Analysis interrupted")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("does not crash when optional evidence fields are missing", async () => {
    const user = userEvent.setup();
    const report = reportFixture();
    report.quality = {};
    report.ocr = {};
    report.evidence = {};
    report.evidence_images = undefined;
    mockedAnalyze.mockResolvedValue(report);
    render(<AnalysisWorkspace />);
    await user.click(await screen.findByRole("button", { name: "Start first inspection" }));
    await user.upload(screen.getByLabelText("Package image"), new File(["jpg"], "package.jpg", { type: "image/jpeg" }));
    await user.click(screen.getByRole("button", { name: /analyze package/i }));

    expect(await screen.findByText("Overall compliance status")).toBeInTheDocument();
    expect(screen.getByText("No OCR evidence was returned.")).toBeInTheDocument();
    expect(screen.getByText("No contrast evidence was returned.")).toBeInTheDocument();
  });

  it("loads a demo image and submits it through the real analysis function", async () => {
    const user = userEvent.setup();
    render(<AnalysisWorkspace />);
    await user.click(await screen.findByRole("button", { name: "Start first inspection" }));
    await user.click(screen.getByRole("button", { name: "Standard package" }));
    expect(mockedDemo).toHaveBeenCalledWith("/demo-samples/standard-package.jpg", "standard-package.jpg");
    await user.click(screen.getByRole("button", { name: /analyze package/i }));
    expect(mockedAnalyze).toHaveBeenCalledWith(expect.objectContaining({ name: "standard-package.jpg" }));
  });
  it("keeps canonical outcomes in session history and clears them on remount", async () => {
    const user = userEvent.setup();
    const view = render(<AnalysisWorkspace />);
    await user.click(await screen.findByRole("button", { name: "Start first inspection" }));
    await user.upload(screen.getByLabelText("Package image"), new File(["jpg"], "session-package.jpg", { type: "image/jpeg" }));
    await user.click(screen.getByRole("button", { name: /analyze package/i }));
    await screen.findByText("Overall compliance status");
    await user.click(screen.getByRole("button", { name: "Inspection History" }));
    expect(screen.getByText("session-package.jpg")).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /session-package\.jpg/ })).toHaveTextContent("REVIEW");
    await user.click(screen.getByRole("button", { name: "Open report" }));
    expect(screen.getByText("LM-R7-001 · Rule 7")).toBeInTheDocument();
    expect(mockedAnalyze).toHaveBeenCalledTimes(1);
    view.unmount();
    render(<AnalysisWorkspace />);
    expect(screen.getByRole("button", { name: "Start first inspection" })).toBeInTheDocument();
    expect(screen.queryByText("session-package.jpg")).not.toBeInTheDocument();
  });

  it("retains a failed save, retries with the same ID, and reloads saved history", async () => {
    const user = userEvent.setup();
    vi.mocked(loadInspections).mockResolvedValue({ inspections: [], hasMore: false });
    vi.mocked(saveInspection).mockRejectedValueOnce(new Error("Report not saved."));
    const view = render(<AnalysisWorkspace accountId="owner" persistenceEnabled />);
    await user.click(await screen.findByRole("button", { name: "Start first inspection" }));
    await user.upload(screen.getByLabelText("Package image"), new File(["jpg"], "package.jpg", { type: "image/jpeg" }));
    await user.click(screen.getByRole("button", { name: /analyze package/i }));
    await screen.findByText("Overall compliance status");
    expect(await screen.findByText("Report not saved.")).toBeInTheDocument();
    expect(screen.getAllByText("REVIEW").length).toBeGreaterThan(0);
    const record = vi.mocked(saveInspection).mock.calls[0][0];
    vi.mocked(saveInspection).mockResolvedValue({ ...record, report: structuredClone(record.report) });
    await user.click(screen.getByRole("button", { name: "Retry saving" }));
    expect(vi.mocked(saveInspection).mock.calls[1][0].id).toBe(record.id);
    expect(screen.queryByText("Report not saved.")).not.toBeInTheDocument();
    view.unmount();
    vi.mocked(loadInspections).mockResolvedValue({ inspections: [record], hasMore: false });
    render(<AnalysisWorkspace accountId="owner" persistenceEnabled />);
    expect(await screen.findByText("SUNLITE REFINED OIL")).toBeInTheDocument();
    expect(vi.mocked(loadInspections)).toHaveBeenCalledWith("owner", 0);
  });

});
