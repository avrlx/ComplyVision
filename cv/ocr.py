"""OCR output normalization for the single-pass package analysis pipeline."""

from __future__ import annotations

from typing import Any


def _as_box(value: Any, offset: tuple[int, int] = (0, 0)) -> list[int]:
    raw = value.tolist() if hasattr(value, "tolist") else list(value)
    x_offset, y_offset = offset
    if raw and isinstance(raw[0], (list, tuple)):
        xs = [float(point[0]) for point in raw]
        ys = [float(point[1]) for point in raw]
        raw = [min(xs), min(ys), max(xs), max(ys)]
    return [
        int(round(float(raw[0]) + x_offset)),
        int(round(float(raw[1]) + y_offset)),
        int(round(float(raw[2]) + x_offset)),
        int(round(float(raw[3]) + y_offset)),
    ]


def predict_ocr_items(
    ocr: Any,
    image: str | Any,
    *,
    offset: tuple[int, int] = (0, 0),
) -> list[dict[str, Any]]:
    """Run PaddleOCR once and normalize its text, confidence and geometry.

    Word-level geometry is retained because the downstream field extractor and
    evidence/reporting layers use the OCR boxes. No second OCR call is performed
    here; accuracy is handled downstream through deterministic normalization and
    field-specific validation.
    """
    try:
        predictions = ocr.predict(image, return_word_box=True)
    except TypeError:  # Test doubles and older compatible wrappers.
        predictions = ocr.predict(image)

    items: list[dict[str, Any]] = []
    for prediction in predictions:
        texts = prediction.get("rec_texts") or []
        scores = prediction.get("rec_scores") or []
        boxes = prediction.get("rec_boxes") or []
        words = prediction.get("text_word") or []
        word_boxes = prediction.get("text_word_boxes") or []

        for index, (text, score, box) in enumerate(zip(texts, scores, boxes)):
            tokens = []
            if index < len(words) and index < len(word_boxes):
                for token, token_box in zip(words[index], word_boxes[index]):
                    if str(token).strip():
                        tokens.append({
                            "text": str(token),
                            "box": _as_box(token_box, offset),
                        })

            items.append({
                "text": str(text),
                "confidence": float(score),
                "box": _as_box(box, offset),
                **({"tokens": tokens} if tokens else {}),
            })

    return items


def recover_split_quantity_items(
    image_path: str,
    items: list[dict[str, Any]],
    ocr: Any,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Compatibility shim: quantity recovery is intentionally disabled.

    The live inspection path is now strictly single-pass OCR. Quantity extraction
    must use the original OCR result rather than launching a crop-level inference.
    The function remains so existing callers/tests do not break.
    """
    return items, {
        "attempted": False,
        "recovered": False,
        "disabled": True,
        "reason": "single_pass_ocr",
    }
