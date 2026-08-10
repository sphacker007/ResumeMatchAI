from __future__ import annotations

import re
from collections import Counter

from app.models import JobAnalysis


SKILL_ALIASES = {
    "Amazon Web Services": ("aws", "amazon web services"),
    "PostgreSQL": ("postgresql", "postgres"),
    "Machine Learning": ("machine learning", "ml"),
    "Generative AI": ("generative ai", "genai"),
    "Large Language Models": ("large language model", "large language models", "llm", "llms"),
    "CI/CD": ("ci/cd", "continuous integration", "continuous deployment"),
    "React": ("react", "react.js", "reactjs"),
    "Node.js": ("node.js", "nodejs", "node"),
    "Python": ("python",), "Java": ("java",), "TypeScript": ("typescript",),
    "JavaScript": ("javascript",), "SQL": ("sql",), "FastAPI": ("fastapi",),
    "Django": ("django",), "Flask": ("flask",), "Docker": ("docker",),
    "Kubernetes": ("kubernetes", "k8s"), "Azure": ("azure",), "GCP": ("gcp", "google cloud"),
    "MySQL": ("mysql",), "MongoDB": ("mongodb",), "Redis": ("redis",),
    "REST APIs": ("rest api", "restful api", "rest apis"), "GraphQL": ("graphql",),
    "Git": ("git",), "Agile": ("agile",), "Scrum": ("scrum",),
    "Data Analysis": ("data analysis", "data analytics"), "NLP": ("nlp", "natural language processing"),
}

SOFT_SKILLS = ("communication", "collaboration", "leadership", "problem solving", "analytical", "teamwork")


def _contains(text: str, phrase: str) -> bool:
    return re.search(rf"(?<!\w){re.escape(phrase.lower())}(?!\w)", text.lower()) is not None


def analyze_job(text: str) -> JobAnalysis:
    lines = [line.strip(" •\t-") for line in text.splitlines() if line.strip()]
    lower = text.lower()
    detected: list[tuple[str, int]] = []
    for canonical, aliases in SKILL_ALIASES.items():
        count = sum(len(re.findall(rf"(?<!\w){re.escape(alias)}(?!\w)", lower)) for alias in aliases)
        if count:
            detected.append((canonical, count))
    detected.sort(key=lambda item: (-item[1], item[0]))
    required_context = " ".join(line for line in lines if re.search(r"required|must|minimum|proficien", line, re.I))
    preferred_context = " ".join(line for line in lines if re.search(r"preferred|nice to have|bonus", line, re.I))
    required = [name for name, _ in detected if any(_contains(required_context, a) for a in SKILL_ALIASES[name])]
    preferred = [name for name, _ in detected if any(_contains(preferred_context, a) for a in SKILL_ALIASES[name])]
    remaining = [name for name, _ in detected if name not in required and name not in preferred]
    required = required or remaining[: min(8, len(remaining))]
    preferred += [name for name in remaining if name not in required]
    title = ""
    for line in lines[:8]:
        match = re.search(r"(?:job title|position|role)\s*[:\-]\s*(.+)", line, re.I)
        if match:
            title = match.group(1).strip()
            break
    company = "Company"
    match = re.search(r"(?:at|join)\s+([A-Z][A-Za-z0-9& .'-]{1,40})", text)
    if match:
        company = match.group(1).strip().splitlines()[0]
    categories = {
        "programming_languages": [x for x in required + preferred if x in {"Python", "Java", "TypeScript", "JavaScript", "SQL"}],
        "frameworks": [x for x in required + preferred if x in {"React", "Node.js", "FastAPI", "Django", "Flask"}],
        "cloud": [x for x in required + preferred if x in {"Amazon Web Services", "Azure", "GCP"}],
        "databases": [x for x in required + preferred if x in {"PostgreSQL", "MySQL", "MongoDB", "Redis"}],
        "ai_ml": [x for x in required + preferred if x in {"Machine Learning", "Generative AI", "Large Language Models", "NLP"}],
    }
    responsibilities = [line for line in lines if re.search(r"develop|build|design|lead|manage|implement|deliver|collaborate", line, re.I)][:10]
    years = re.findall(r"\b\d+\+?\s+years?[^.\n]*", text, re.I)
    soft = [skill.title() for skill in SOFT_SKILLS if skill in lower]
    all_keywords = list(dict.fromkeys(required + preferred + soft))
    return JobAnalysis(
        job_title=title,
        company_name=company,
        required_skills=required,
        preferred_skills=preferred,
        tools=[x for x in all_keywords if x in {"Docker", "Kubernetes", "Git"}],
        methodologies=[x for x in all_keywords if x in {"Agile", "Scrum", "CI/CD"}],
        responsibilities=responsibilities,
        experience_requirements=years,
        soft_skills=soft,
        ats_keywords=all_keywords,
        **categories,
    )

