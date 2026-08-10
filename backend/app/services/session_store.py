from __future__ import annotations

import shutil
import tempfile
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path

from app.models import JobAnalysis, ScoreBreakdown, TextRegion


SESSION_TTL_SECONDS = 60 * 60
ROOT = Path(tempfile.gettempdir()) / "resume-match-ai"


@dataclass
class SessionData:
    id: str
    directory: Path
    original_path: Path
    original_filename: str
    regions: list[TextRegion]
    job_description: str
    job_analysis: JobAnalysis
    original_score: ScoreBreakdown
    scanned: bool
    formatting_confidence: int
    created_at: float = field(default_factory=time.time)
    generated_path: Path | None = None
    generated_filename: str | None = None


class SessionStore:
    def __init__(self) -> None:
        ROOT.mkdir(parents=True, exist_ok=True)
        self.sessions: dict[str, SessionData] = {}

    def cleanup(self) -> None:
        now = time.time()
        for session_id, session in list(self.sessions.items()):
            if now - session.created_at > SESSION_TTL_SECONDS:
                shutil.rmtree(session.directory, ignore_errors=True)
                self.sessions.pop(session_id, None)

    def create_directory(self) -> tuple[str, Path]:
        self.cleanup()
        session_id = uuid.uuid4().hex
        directory = ROOT / session_id
        directory.mkdir(parents=True)
        return session_id, directory

    def put(self, session: SessionData) -> None:
        self.sessions[session.id] = session

    def get(self, session_id: str) -> SessionData | None:
        self.cleanup()
        return self.sessions.get(session_id)


store = SessionStore()

