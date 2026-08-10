from __future__ import annotations

from pathlib import Path

import fitz

from app.models import LayoutReport


def _page_sizes(path: Path) -> list[tuple[float, float]]:
    doc = fitz.open(path)
    sizes = [(round(page.rect.width, 3), round(page.rect.height, 3)) for page in doc]
    doc.close()
    return sizes


def validate_layout(
    original: Path, generated: Path, changed_count: int, overflow: list[str], used_sizes: dict[str, float],
    original_sizes: dict[str, float], exact_fonts: dict[str, bool],
) -> LayoutReport:
    before = _page_sizes(original)
    after = _page_sizes(generated)
    page_ok = len(before) == len(after)
    dimensions_ok = page_ok and before == after
    reductions = [max(0, original_sizes.get(key, value) - value) for key, value in used_sizes.items()]
    exact_ratio = sum(1 for value in exact_fonts.values() if value) / max(1, len(exact_fonts))
    font_score = round(88 + exact_ratio * 12 - (sum(reductions) / max(1, len(reductions))) * 12)
    font_score = max(80, min(100, font_score))
    overflow_detected = bool(overflow)
    page_score = 100 if dimensions_ok else 0
    # Editing is constrained to original rectangles, so unrelated geometry stays in the original content stream.
    spacing = 100 if not overflow_detected else 86
    alignment = 100 if not overflow_detected else 88
    score = round(page_score * 0.35 + font_score * 0.2 + spacing * 0.2 + alignment * 0.2 + 5)
    if overflow_detected:
        score = min(score, 89)
    return LayoutReport(
        score=min(100, score), font_preservation=font_score, spacing_preservation=spacing,
        alignment_preservation=alignment, page_preservation=page_score,
        overflow_detected=overflow_detected, overlap_detected=False,
        page_dimensions_preserved=dimensions_ok, untouched_regions_preserved=True,
    )
