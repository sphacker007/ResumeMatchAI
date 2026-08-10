from __future__ import annotations

from pathlib import Path

import fitz

from app.models import Change, TextRegion


BASE14 = {
    "bolditalic": "hebi", "boldoblique": "hebi", "bold": "hebo",
    "italic": "heit", "oblique": "heit", "regular": "helv",
}


def _font_name(original: str) -> str:
    lower = original.lower()
    family = "helv"
    if "times" in lower:
        family = "tiro"
    elif "courier" in lower:
        family = "cour"
    for marker, font in BASE14.items():
        if marker in lower:
            if family == "tiro":
                return {"hebi": "tibi", "hebo": "tibo", "heit": "tiit", "helv": "tiro"}[font]
            if family == "cour":
                return {"hebi": "cobi", "hebo": "cobo", "heit": "coit", "helv": "cour"}[font]
            return font
    return family


def _normalized_font(value: str) -> str:
    value = value.split("+")[-1].lower()
    return "".join(char for char in value if char.isalnum())


def _font_resource(
    doc: fitz.Document, page: fitz.Page, region: TextRegion, cache: dict[tuple[int, str], tuple[str, bool]],
) -> tuple[str, bool]:
    key = (region.page, region.font)
    if key in cache:
        return cache[key]
    target = _normalized_font(region.font)
    for font in page.get_fonts(full=True):
        xref, basefont, resource_name = int(font[0]), str(font[3]), str(font[4])
        if target not in {_normalized_font(basefont), _normalized_font(resource_name)} or xref <= 0:
            continue
        try:
            extracted = doc.extract_font(xref)
            buffer = extracted[3]
            if buffer:
                alias = f"RMF{region.page}{len(cache)}"
                page.insert_font(fontname=alias, fontbuffer=buffer)
                cache[key] = (alias, True)
                return cache[key]
        except Exception:
            break
    known_base14 = any(name in region.font.lower() for name in ("helvetica", "arial", "times", "courier"))
    cache[key] = (_font_name(region.font), known_base14)
    return cache[key]


def _rgb(color: int) -> tuple[float, float, float]:
    return (((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255)


def create_tailored_pdf(
    source: Path, output: Path, regions: list[TextRegion], changes: list[Change]
) -> tuple[list[str], list[str], dict[str, float], dict[str, bool]]:
    output.unlink(missing_ok=True)
    doc = fitz.open(source)
    by_id = {region.id: region for region in regions}
    accepted = [c for c in changes if c.status == "accepted" and c.region_id in by_id]
    for change in accepted:
        region = by_id[change.region_id]
        page = doc[region.page]
        rect = fitz.Rect(region.bbox)
        pad = max(0.4, region.size * 0.06)
        redact = fitz.Rect(rect.x0 - pad, rect.y0 - pad, rect.x1 + pad, rect.y1 + pad)
        page.add_redact_annot(redact, fill=None, cross_out=False)
    for page in doc:
        page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE, graphics=fitz.PDF_REDACT_LINE_ART_NONE)

    fitted: list[str] = []
    overflow: list[str] = []
    used_sizes: dict[str, float] = {}
    exact_fonts: dict[str, bool] = {}
    font_cache: dict[tuple[int, str], tuple[str, bool]] = {}
    for change in accepted:
        region = by_id[change.region_id]
        page = doc[region.page]
        rect = fitz.Rect(region.bbox)
        page_regions = [r for r in regions if r.page == region.page and r.id != region.id]
        right_obstacles = [
            fitz.Rect(r.bbox).x0 for r in page_regions
            if fitz.Rect(r.bbox).x0 >= rect.x1 - 0.5
            and fitz.Rect(r.bbox).y0 < rect.y1
            and fitz.Rect(r.bbox).y1 > rect.y0
        ]
        content_right = max((r.bbox[2] for r in page_regions), default=page.rect.x1 - 36)
        safe_right = min(right_obstacles) - 2 if right_obstacles else min(page.rect.x1 - 36, max(rect.x1, content_right))
        # Textbox coordinates need a small ascent allowance while retaining the same horizontal bounds.
        insert_rect = fitz.Rect(rect.x0, rect.y0 - region.size * 0.18, safe_right, rect.y1 + region.size * 0.35)
        font_name, exact_font = _font_resource(doc, page, region, font_cache)
        success = False
        for reduction in (0.0, 0.25, 0.5):
            size = max(6, region.size - reduction)
            remaining = page.insert_textbox(
                insert_rect, change.replacement_text, fontsize=size, fontname=font_name,
                color=_rgb(region.color), align=fitz.TEXT_ALIGN_LEFT, lineheight=1.0, overlay=True,
            )
            if remaining >= 0:
                fitted.append(change.id)
                used_sizes[change.id] = size
                exact_fonts[change.id] = exact_font
                success = True
                break
        if not success:
            overflow.append(change.id)
    doc.save(output, garbage=4, deflate=True, clean=True)
    doc.close()
    return fitted, overflow, used_sizes, exact_fonts
