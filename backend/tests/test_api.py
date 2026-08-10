from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_upload_analyze_tailor_generate_download(sample_resume: Path, sample_jd: str, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    with sample_resume.open("rb") as handle:
        response = client.post(
            "/api/analyze",
            files={"resume": ("Alex_Rivera.pdf", handle, "application/pdf")},
            data={"job_description": sample_jd},
        )
    assert response.status_code == 200, response.text
    analysis = response.json()
    assert analysis["pages"] == 1
    tailored = client.post("/api/tailor", json={"session_id": analysis["session_id"], "strength": "balanced"})
    assert tailored.status_code == 200, tailored.text
    payload = tailored.json()
    generated = client.post(
        "/api/generate", json={"session_id": analysis["session_id"], "changes": payload["changes"]},
    )
    assert generated.status_code == 200, generated.text
    result = generated.json()
    assert result["layout"]["score"] >= 98
    download = client.get(result["download_url"])
    assert download.status_code == 200
    assert download.content.startswith(b"%PDF-")


def test_rejects_non_pdf(sample_jd: str):
    response = client.post(
        "/api/analyze", files={"resume": ("bad.pdf", b"not a pdf", "application/pdf")},
        data={"job_description": sample_jd},
    )
    assert response.status_code == 422
