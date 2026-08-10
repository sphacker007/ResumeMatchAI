from __future__ import annotations

import re
import time
from collections import defaultdict, deque
from pathlib import Path

import fitz
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.models import (
    AnalyzeResponse, GenerateRequest, GenerateResponse, TailorRequest, TailorResponse,
)
from app.services.jd_analyzer import analyze_job
from app.services.layout_guard import validate_layout
from app.services.matching_engine import score_resume
from app.services.pdf_editor import create_tailored_pdf
from app.services.pdf_parser import extract_regions, plain_text
from app.services.session_store import SessionData, store
from app.services.tailoring_engine import propose_changes


MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_JD_CHARS = 30_000
ALLOWED_ORIGINS = [origin.strip() for origin in __import__("os").getenv(
    "ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
).split(",") if origin.strip()]

app = FastAPI(title="ResumeMatch AI API", version="1.0.0")
app.add_middleware(
    CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_credentials=False,
    allow_methods=["GET", "POST"], allow_headers=["Content-Type"],
)

requests_by_ip: dict[str, deque[float]] = defaultdict(deque)


@app.middleware("http")
async def basic_rate_limit(request: Request, call_next):
    if request.url.path == "/health":
        return await call_next(request)
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    bucket = requests_by_ip[ip]
    while bucket and now - bucket[0] > 60:
        bucket.popleft()
    if len(bucket) >= 30:
        from fastapi.responses import JSONResponse
        return JSONResponse({"detail": "Rate limit exceeded. Try again shortly."}, status_code=429)
    bucket.append(now)
    return await call_next(request)


def _session(session_id: str) -> SessionData:
    value = store.get(session_id)
    if not value:
        raise HTTPException(404, "Session expired or not found. Please analyze the resume again.")
    return value


def _safe_stem(filename: str) -> str:
    stem = Path(filename).stem
    cleaned = re.sub(r"[^A-Za-z0-9_-]+", "_", stem).strip("_")
    return cleaned[:80] or "Resume"


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze(resume: UploadFile = File(...), job_description: str = Form(...)):
    if resume.content_type not in {"application/pdf", "application/x-pdf"}:
        raise HTTPException(415, "Only PDF resumes are supported.")
    if not 80 <= len(job_description.strip()) <= MAX_JD_CHARS:
        raise HTTPException(422, "Job description must be between 80 and 30,000 characters.")
    content = await resume.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "PDF exceeds the 10 MB upload limit.")
    if not content.startswith(b"%PDF-"):
        raise HTTPException(422, "The uploaded file is not a valid PDF.")
    session_id, directory = store.create_directory()
    filename = _safe_stem(resume.filename or "Resume") + ".pdf"
    original = directory / "original.pdf"
    original.write_bytes(content)
    try:
        with fitz.open(original) as doc:
            if doc.needs_pass or doc.page_count < 1 or doc.page_count > 10:
                raise ValueError("Unsupported encrypted or oversized document")
            pages = doc.page_count
        regions, scanned, confidence = extract_regions(original)
    except Exception as exc:
        import shutil
        shutil.rmtree(directory, ignore_errors=True)
        raise HTTPException(422, "PDF is encrypted, damaged, or unsupported.") from exc
    job = analyze_job(job_description)
    score = score_resume(plain_text(regions), job)
    data = SessionData(
        id=session_id, directory=directory, original_path=original, original_filename=filename,
        regions=regions, job_description=job_description, job_analysis=job, original_score=score,
        scanned=scanned, formatting_confidence=confidence,
    )
    store.put(data)
    return AnalyzeResponse(
        session_id=session_id, filename=filename, scanned=scanned, formatting_confidence=confidence,
        job_analysis=job, original=score, pages=pages,
    )


@app.post("/api/tailor", response_model=TailorResponse)
def tailor(request: TailorRequest):
    session = _session(request.session_id)
    if session.scanned:
        raise HTTPException(422, "Scanned resume detected. Exact editable formatting has lower confidence; no PDF was changed.")
    try:
        changes = propose_changes(session.regions, session.job_analysis, request.strength)
    except Exception as exc:
        raise HTTPException(502, "The AI provider could not produce valid tailoring changes. Please retry.") from exc
    combined = plain_text(session.regions)
    for change in changes:
        if change.status == "accepted":
            combined = combined.replace(change.original_text, change.replacement_text, 1)
    tailored_score = score_resume(combined, session.job_analysis)
    return TailorResponse(
        session_id=session.id, original=session.original_score, tailored=tailored_score, changes=changes,
    )


@app.post("/api/generate", response_model=GenerateResponse)
def generate(request: GenerateRequest):
    session = _session(request.session_id)
    valid_by_region = {region.id: region for region in session.regions}
    for change in request.changes:
        if change.status != "accepted":
            continue
        region = valid_by_region.get(change.region_id)
        if not region or change.original_text != region.text:
            raise HTTPException(422, "A proposed change no longer matches the original PDF text.")
        if len(change.replacement_text) > max(40, int(len(change.original_text) * 1.18)):
            raise HTTPException(422, f"Change {change.id} is too long for its locked layout region. Use Fit Text or shorten it.")
    company = _safe_stem(session.job_analysis.company_name)
    output_name = f"{Path(session.original_filename).stem}_Tailored_{company}.pdf"
    output = session.directory / output_name
    fitted, overflow, used_sizes, exact_fonts = create_tailored_pdf(
        session.original_path, output, session.regions, request.changes
    )
    original_sizes = {c.id: valid_by_region[c.region_id].size for c in request.changes if c.region_id in valid_by_region}
    layout = validate_layout(
        session.original_path, output, len(fitted), overflow, used_sizes, original_sizes, exact_fonts,
    )
    if overflow or layout.score < 98:
        output.unlink(missing_ok=True)
        raise HTTPException(422, "One or more edits could not fit safely. Shorten the flagged replacement text and retry.")
    combined = plain_text(session.regions)
    for change in request.changes:
        if change.status == "accepted":
            combined = combined.replace(change.original_text, change.replacement_text, 1)
    tailored = score_resume(combined, session.job_analysis)
    session.generated_path = output
    session.generated_filename = output_name
    return GenerateResponse(
        session_id=session.id, filename=output_name, layout=layout, tailored=tailored,
        download_url=f"/api/sessions/{session.id}/download",
        preview_url=f"/api/sessions/{session.id}/tailored.pdf",
    )


@app.get("/api/sessions/{session_id}/original.pdf")
def original_pdf(session_id: str):
    session = _session(session_id)
    return FileResponse(session.original_path, media_type="application/pdf", filename=session.original_filename)


@app.get("/api/sessions/{session_id}/tailored.pdf")
def tailored_pdf(session_id: str):
    session = _session(session_id)
    if not session.generated_path or not session.generated_path.exists():
        raise HTTPException(404, "Tailored PDF has not been generated.")
    return FileResponse(session.generated_path, media_type="application/pdf")


@app.get("/api/sessions/{session_id}/download")
def download(session_id: str):
    session = _session(session_id)
    if not session.generated_path or not session.generated_path.exists():
        raise HTTPException(404, "Tailored PDF has not been generated.")
    return FileResponse(
        session.generated_path, media_type="application/pdf", filename=session.generated_filename,
    )
