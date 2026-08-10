from pathlib import Path

import fitz

from app.models import Change
from app.services.jd_analyzer import analyze_job
from app.services.layout_guard import validate_layout
from app.services.matching_engine import score_resume
from app.services.pdf_editor import create_tailored_pdf
from app.services.pdf_parser import extract_regions, plain_text


def test_extracts_coordinate_mapped_text(sample_resume: Path):
    regions, scanned, confidence = extract_regions(sample_resume)
    assert not scanned
    assert confidence >= 92
    assert any(region.text == "SUMMARY" and region.page == 0 for region in regions)
    assert all(region.bbox[2] > region.bbox[0] for region in regions)


def test_jd_and_semantic_skill_matching(sample_resume: Path, sample_jd: str):
    regions, _, _ = extract_regions(sample_resume)
    job = analyze_job(sample_jd)
    score = score_resume(plain_text(regions), job)
    assert "Amazon Web Services" in score.matched_keywords
    assert "PostgreSQL" in score.matched_keywords
    assert "FastAPI" in score.missing_keywords
    assert score.score > 60


def test_in_place_replacement_preserves_page_and_searchability(sample_resume: Path, artifacts_dir: Path):
    regions, _, _ = extract_regions(sample_resume)
    target = next(region for region in regions if "AWS" in region.text and region.section == "skills")
    replacement = target.text.replace("AWS", "Amazon Web Services")
    change = Change(
        id="change-1", region_id=target.id, section=target.section, original_text=target.text,
        replacement_text=replacement, reason="Terminology normalization", jd_keywords=["Amazon Web Services"],
    )
    output = artifacts_dir / "sample_resume_tailored.pdf"
    fitted, overflow, sizes, exact_fonts = create_tailored_pdf(sample_resume, output, regions, [change])
    assert fitted == ["change-1"]
    assert not overflow
    with fitz.open(sample_resume) as before, fitz.open(output) as after:
        assert before.page_count == after.page_count
        assert before[0].rect == after[0].rect
        assert "Amazon Web Services" in after[0].get_text()
        assert "ALEX RIVERA" in after[0].get_text()
    report = validate_layout(
        sample_resume, output, 1, overflow, sizes, {"change-1": target.size}, exact_fonts
    )
    assert report.score >= 98
    assert report.page_dimensions_preserved
    assert not report.overflow_detected


def test_overflow_is_detected(sample_resume: Path, artifacts_dir: Path):
    regions, _, _ = extract_regions(sample_resume)
    target = next(region for region in regions if region.text.startswith("Built Python"))
    change = Change(
        id="change-long", region_id=target.id, section=target.section, original_text=target.text,
        replacement_text="Built " + ("extremely long unsupported wording " * 20),
        reason="test", jd_keywords=[],
    )
    output = artifacts_dir / "overflow.pdf"
    _, overflow, _, _ = create_tailored_pdf(sample_resume, output, regions, [change])
    assert overflow == ["change-long"]
