from __future__ import annotations

import re

from app.models import JobAnalysis, ScoreBreakdown
from app.services.jd_analyzer import SKILL_ALIASES


def _has(text: str, term: str) -> bool:
    aliases = SKILL_ALIASES.get(term, (term.lower(),))
    return any(re.search(rf"(?<!\w){re.escape(alias)}(?!\w)", text.lower()) for alias in aliases)


def score_resume(resume_text: str, job: JobAnalysis) -> ScoreBreakdown:
    weighted: list[tuple[str, int]] = []
    weighted += [(x, 4) for x in job.required_skills]
    weighted += [(x, 2) for x in job.preferred_skills]
    weighted += [(x, 1) for x in job.soft_skills]
    deduped: dict[str, int] = {}
    for term, weight in weighted:
        deduped[term] = max(weight, deduped.get(term, 0))
    matched = [term for term in deduped if _has(resume_text, term)]
    missing = [term for term in deduped if term not in matched]
    earned = sum(deduped[x] for x in matched)
    possible = sum(deduped.values()) or 1
    coverage = round(100 * earned / possible)
    title_bonus = 10 if job.job_title and job.job_title.lower() in resume_text.lower() else 0
    score = min(100, round(coverage * 0.9 + title_bonus))
    return ScoreBreakdown(
        score=score,
        ats_coverage=coverage,
        matched_keywords=matched,
        missing_keywords=missing,
        unsupported_keywords=missing,
        skills_already_present=matched,
    )

