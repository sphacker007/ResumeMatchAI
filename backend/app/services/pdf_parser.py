from __future__ import annotations

import hashlib
import re
from pathlib import Path

import fitz

from app.models import TextRegion


SECTION_WORDS = {
    "summary": {"summary", "profile", "objective"},
    "skills": {"skills", "technologies", "technical skills", "core competencies"},
    "experience": {"experience", "employment", "work history", "professional experience"},
    "projects": {"projects", "selected projects"},
    "education": {"education", "academic background"},
    "certifications": {"certifications", "licenses"},
}


def _section_for(text: str, current: str) -> str:
    normalized = re.sub(r"[^a-z ]", "", text.lower()).strip()
    for section, names in SECTION_WORDS.items():
        if normalized in names:
            return section
    return current


def extract_regions(path: Path) -> tuple[list[TextRegion], bool, int]:
    regions: list[TextRegion] = []
    doc = fitz.open(path)
    total_area = sum(page.rect.width * page.rect.height for page in doc) or 1
    text_area = 0.0
    current_section = "contact"
    for page_no, page in enumerate(doc):
        data = page.get_text("dict", flags=fitz.TEXTFLAGS_TEXT)
        for block_no, block in enumerate(data.get("blocks", [])):
            if block.get("type") != 0:
                continue
            for line_no, line in enumerate(block.get("lines", [])):
                spans = [span for span in line.get("spans", []) if span.get("text", "").strip()]
                if not spans:
                    continue
                text = "".join(span["text"] for span in spans).strip()
                if not text:
                    continue
                bbox = fitz.Rect(line["bbox"])
                current_section = _section_for(text, current_section)
                first = spans[0]
                digest = hashlib.sha1(f"{page_no}:{block_no}:{line_no}:{text}".encode()).hexdigest()[:12]
                regions.append(
                    TextRegion(
                        id=digest,
                        page=page_no,
                        text=text,
                        bbox=tuple(round(v, 3) for v in bbox),
                        font=first.get("font", "Helvetica"),
                        size=float(first.get("size", 10)),
                        color=int(first.get("color", 0)),
                        section=current_section,
                    )
                )
                text_area += bbox.width * bbox.height
    doc.close()
    extracted_chars = sum(len(r.text) for r in regions)
    scanned = extracted_chars < 80 or text_area / total_area < 0.002
    confidence = 45 if scanned else min(100, 92 + min(8, extracted_chars // 500))
    return regions, scanned, confidence


def plain_text(regions: list[TextRegion]) -> str:
    return "\n".join(region.text for region in regions)

