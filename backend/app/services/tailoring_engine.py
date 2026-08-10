from __future__ import annotations

import re

from app.models import Change, JobAnalysis, TextRegion
from app.services.ai_provider import get_ai_provider
from app.services.jd_analyzer import SKILL_ALIASES


PROTECTED_PATTERNS = (
    r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", r"https?://", r"linkedin\.com", r"\+?\d[\d ()-]{7,}",
    r"\b(?:19|20)\d{2}\b", r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b",
)


def _protected(text: str, section: str) -> bool:
    return section in {"contact", "education"} or any(re.search(p, text, re.I) for p in PROTECTED_PATTERNS)


def _fit_status(original: str, replacement: str) -> str:
    ratio = len(replacement) / max(1, len(original))
    return "fits" if ratio <= 1.03 else "tight" if ratio <= 1.12 else "overflow"


def deterministic_changes(regions: list[TextRegion], job: JobAnalysis, strength: str) -> list[Change]:
    """Truth-safe alias normalization when no external AI key is configured."""
    resume_text = "\n".join(r.text for r in regions).lower()
    changes: list[Change] = []
    limit = {"conservative": 3, "balanced": 6, "aggressive": 10}[strength]
    for canonical in job.ats_keywords:
        aliases = SKILL_ALIASES.get(canonical, ())
        if canonical.lower() not in " ".join(job.ats_keywords).lower():
            continue
        demonstrated = [alias for alias in aliases if re.search(rf"(?<!\w){re.escape(alias)}(?!\w)", resume_text)]
        if not demonstrated:
            continue
        for region in regions:
            if _protected(region.text, region.section):
                continue
            for alias in demonstrated:
                if alias.lower() == canonical.lower() or len(canonical) > len(alias) * 1.5:
                    continue
                replacement = re.sub(rf"(?<!\w){re.escape(alias)}(?!\w)", canonical, region.text, count=1, flags=re.I)
                if replacement == region.text:
                    continue
                changes.append(
                    Change(
                        id=f"change-{len(changes) + 1}", region_id=region.id, section=region.section,
                        original_text=region.text, replacement_text=replacement,
                        reason=f"Uses the employer's terminology for an equivalent skill already evidenced in the resume.",
                        jd_keywords=[canonical], fit_status=_fit_status(region.text, replacement),
                    )
                )
                break
            if len(changes) >= limit:
                return changes
    return changes


def propose_changes(regions: list[TextRegion], job: JobAnalysis, strength: str) -> list[Change]:
    provider = get_ai_provider()
    changes = provider.propose_changes(regions, job, strength) if provider else deterministic_changes(regions, job, strength)
    by_id = {r.id: r for r in regions}
    safe: list[Change] = []
    for change in changes:
        region = by_id.get(change.region_id)
        if not region or _protected(region.text, region.section) or change.original_text != region.text:
            continue
        change.fit_status = _fit_status(change.original_text, change.replacement_text)
        if change.fit_status == "overflow":
            change.status = "rejected"
        safe.append(change)
    return safe
