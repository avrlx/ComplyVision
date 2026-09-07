"""HTTP-independent orchestration of the existing package-analysis pipeline."""

from __future__ import annotations

import threading
import tempfile
from pathlib import Path
from typing import Any, Callable

from batch_measure import process_image
from reporting.report import build_package_report
from services.declaration_extractor import add_enhanced_report_fields, enhance_extracted_fields
from services.evidence import build_evidence_images, scrub_local_paths
from services.mrp_extractor import correct_mrp
# Kept as a compatibility symbol for existing tests/mocks. The live path does
# not call it; production inspection is strictly single-pass OCR.
from services.ocr_ensemble import run_ocr_ensemble


class PackageAnalysisError(RuntimeError):
    """Raised when a technical failure prevents report generation."""


def _default_ocr_factory() -> Any:
    from paddleocr import PaddleOCR

    # Live inspection uses one OCR inference pass. Document orientation,
    # unwarping and text-line orientation models are intentionally disabled for
    # the mostly upright package-label images used by this application.
    # MKL-DNN is enabled for faster CPU inference when PaddleOCR supports it.
    return PaddleOCR(
        lang="en",
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
        enable_mkldnn=True,
    )


class PackageAnalyzer:
    """Reuse one OCR model and run exactly one live OCR inference per image."""

    def __init__(
        self,
        *,
        ocr_factory: Callable[[], Any] = _default_ocr_factory,
        image_processor: Callable[..., dict[str, Any]] = process_image,
        report_builder: Callable[..., dict[str, Any]] = build_package_report,
        evidence_builder: Callable[..., list[dict[str, Any]]] = build_evidence_images,
    ) -> None:
        self._ocr_factory = ocr_factory
        self._image_processor = image_processor
        self._report_builder = report_builder
        self._evidence_builder = evidence_builder
        self._ocr: Any | None = None
        self._initialization_lock = threading.Lock()
        self._inference_lock = threading.Lock()

    @property
    def ocr_initialized(self) -> bool:
        return self._ocr is not None

    def warm_up(self) -> None:
        """Load OCR models before the first user-facing inspection request."""
        self._get_ocr()

    def _get_ocr(self) -> Any:
        if self._ocr is None:
            with self._initialization_lock:
                if self._ocr is None:
                    self._ocr = self._ocr_factory()
        return self._ocr

    def analyze_package(
        self, image_path: str | Path, *, display_filename: str = "uploaded_image.jpg",
    ) -> dict[str, Any]:
        """Return the canonical report; request-local artifacts remain private."""
        path = Path(image_path)
        if not path.is_file():
            raise PackageAnalysisError("Input image is unavailable")
        try:
            with tempfile.TemporaryDirectory(prefix="sih26034_evidence_") as directory:
                evidence_root = Path(directory)
                glyph_debug_path = evidence_root / "glyph.jpg"
                with self._inference_lock:
                    ocr = self._get_ocr()
                    # process_image performs the single OCR inference and all
                    # downstream extraction/measurement using that same result.
                    batch_result = self._image_processor(
                        path,
                        ocr,
                        debug_path=glyph_debug_path,
                    )

                if batch_result.get("failure_stage") == "unexpected_exception":
                    raise PackageAnalysisError("The analysis pipeline failed unexpectedly")
                evidence_images = self._evidence_builder(path, batch_result, evidence_root)

            safe_result = scrub_local_paths(batch_result)
            safe_result["evidence_images"] = evidence_images
            safe_result["image"] = Path(display_filename).name
            safe_result.setdefault("ocr", {})["inference_passes"] = 1
            safe_result["ocr"]["ensemble"] = {
                "passes": 1,
                "skipped": True,
                "reason": "single_pass_ocr",
            }

            # Improve field normalization without performing another OCR call.
            safe_result["extracted_fields"] = enhance_extracted_fields(
                safe_result.get("extracted_fields") or {}
            )
            safe_result["extracted_fields"] = correct_mrp(
                safe_result["extracted_fields"]
            )

            extracted_fields = dict(safe_result.get("extracted_fields") or {})
            extracted_fields["font_height_measurement"] = safe_result.get("glyph_measurement")
            if safe_result.get("principal_display_panel_area_cm2") is not None:
                extracted_fields["principal_display_panel_area_cm2"] = safe_result[
                    "principal_display_panel_area_cm2"
                ]
            if safe_result.get("package_surface_formed") is not None:
                extracted_fields["package_surface_formed"] = safe_result[
                    "package_surface_formed"
                ]
            safe_result["extracted_fields"] = extracted_fields

            report = self._report_builder(safe_result)
            report = add_enhanced_report_fields(report, safe_result["extracted_fields"])
            return report
        except PackageAnalysisError:
            raise
        except Exception as exc:
            raise PackageAnalysisError("The analysis pipeline could not produce a report") from exc
