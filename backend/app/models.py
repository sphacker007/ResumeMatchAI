from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class TextRegion(BaseModel):
    id: str
    page: int
    text: str
    bbox: tuple[float, float, float, float]
    font: str = "Helvetica"
    size: float = 10.0
    color: int = 0
    line_count: int = 1
    section: str = "other"


class JobAnalysis(BaseModel):
    job_title: str = ""
    company_name: str = "Company"
    required_skills: list[str] = Field(default_factory=list)
    preferred_skills: list[str] = Field(default_factory=list)
    tools: list[str] = Field(default_factory=list)
    programming_languages: list[str] = Field(default_factory=list)
    frameworks: list[str] = Field(default_factory=list)
    cloud: list[str] = Field(default_factory=list)
    databases: list[str] = Field(default_factory=list)
    ai_ml: list[str] = Field(default_factory=list)
    methodologies: list[str] = Field(default_factory=list)
    domain_keywords: list[str] = Field(default_factory=list)
    responsibilities: list[str] = Field(default_factory=list)
    leadership_requirements: list[str] = Field(default_factory=list)
    experience_requirements: list[str] = Field(default_factory=list)
    education_requirements: list[str] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    soft_skills: list[str] = Field(default_factory=list)
    ats_keywords: list[str] = Field(default_factory=list)


class Change(BaseModel):
    id: str
    region_id: str
    section: str
    original_text: str
    replacement_text: str
    reason: str
    jd_keywords: list[str] = Field(default_factory=list)
    supported_by_resume: bool = True
    status: Literal["accepted", "rejected"] = "accepted"
    fit_status: Literal["fits", "tight", "overflow"] = "fits"


class ScoreBreakdown(BaseModel):
    score: int
    ats_coverage: int
    matched_keywords: list[str]
    missing_keywords: list[str]
    unsupported_keywords: list[str]
    skills_already_present: list[str]


class AnalyzeResponse(BaseModel):
    session_id: str
    filename: str
    scanned: bool
    formatting_confidence: int
    job_analysis: JobAnalysis
    original: ScoreBreakdown
    pages: int


class TailorRequest(BaseModel):
    session_id: str
    strength: Literal["conservative", "balanced", "aggressive"] = "balanced"


class TailorResponse(BaseModel):
    session_id: str
    original: ScoreBreakdown
    tailored: ScoreBreakdown
    changes: list[Change]


class GenerateRequest(BaseModel):
    session_id: str
    changes: list[Change]


class LayoutReport(BaseModel):
    score: int
    font_preservation: int
    spacing_preservation: int
    alignment_preservation: int
    page_preservation: int
    overflow_detected: bool
    overlap_detected: bool
    page_dimensions_preserved: bool
    untouched_regions_preserved: bool


class GenerateResponse(BaseModel):
    session_id: str
    filename: str
    layout: LayoutReport
    tailored: ScoreBreakdown
    download_url: str
    preview_url: str

