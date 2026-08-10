from pathlib import Path

import fitz
import pytest


@pytest.fixture(scope="session")
def artifacts_dir() -> Path:
    path = Path(__file__).parent / ".artifacts"
    path.mkdir(exist_ok=True)
    return path


@pytest.fixture(scope="session")
def sample_resume(artifacts_dir: Path) -> Path:
    path = artifacts_dir / "sample_resume.pdf"
    path.unlink(missing_ok=True)
    doc = fitz.open()
    page = doc.new_page(width=612, height=792)
    page.draw_rect(fitz.Rect(36, 32, 576, 760), color=(0.12, 0.20, 0.32), width=1)
    page.insert_text((48, 64), "ALEX RIVERA", fontsize=19, fontname="hebo", color=(0.05, 0.12, 0.22))
    page.insert_text((48, 83), "alex@example.com | (555) 010-2020 | New York, NY", fontsize=9)
    page.draw_line((48, 94), (564, 94), color=(0.12, 0.20, 0.32), width=1)
    page.insert_text((48, 120), "SUMMARY", fontsize=10, fontname="hebo")
    page.insert_text((48, 138), "Software engineer building Python services and REST APIs for data products.", fontsize=9)
    page.insert_text((48, 170), "SKILLS", fontsize=10, fontname="hebo")
    page.insert_text((48, 188), "Python | AWS | Postgres | Docker | Git | Agile", fontsize=9)
    page.insert_text((48, 220), "EXPERIENCE", fontsize=10, fontname="hebo")
    page.insert_text((48, 240), "Software Engineer | Northstar Labs | 2021 - Present", fontsize=9, fontname="hebo")
    page.insert_text((58, 260), "Built Python REST APIs and deployed services on AWS.", fontsize=9)
    page.insert_text((58, 278), "Collaborated with product teams using Agile delivery practices.", fontsize=9)
    page.insert_text((48, 318), "EDUCATION", fontsize=10, fontname="hebo")
    page.insert_text((48, 338), "B.S. Computer Science | State University | 2021", fontsize=9)
    doc.save(path)
    doc.close()
    return path


@pytest.fixture(scope="session")
def sample_jd() -> str:
    return """Job Title: Backend Software Engineer
Required: Python, REST APIs, Amazon Web Services, PostgreSQL, Docker and Git.
Build reliable backend services and collaborate in an Agile product team.
Preferred: FastAPI and Kubernetes.
"""
