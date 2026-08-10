"use client";

import { ChangeEvent, DragEvent, useMemo, useState } from "react";

type Score = {
  score: number;
  ats_coverage: number;
  matched_keywords: string[];
  missing_keywords: string[];
  unsupported_keywords: string[];
  skills_already_present: string[];
};

type Analysis = {
  session_id: string;
  filename: string;
  scanned: boolean;
  formatting_confidence: number;
  pages: number;
  original: Score;
  job_analysis: { job_title: string; company_name: string; required_skills: string[]; preferred_skills: string[] };
};

type Change = {
  id: string;
  region_id: string;
  section: string;
  original_text: string;
  replacement_text: string;
  reason: string;
  jd_keywords: string[];
  supported_by_resume: boolean;
  status: "accepted" | "rejected";
  fit_status: "fits" | "tight" | "overflow";
};

type Tailoring = { original: Score; tailored: Score; changes: Change[] };
type Generated = {
  filename: string;
  download_url: string;
  preview_url: string;
  tailored: Score;
  layout: {
    score: number;
    font_preservation: number;
    spacing_preservation: number;
    alignment_preservation: number;
    page_preservation: number;
    overflow_detected: boolean;
  };
};

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function ScoreRing({ value, label }: { value: number; label: string }) {
  return (
    <div className="score-wrap" aria-label={`${label}: ${value}%`}>
      <div className="score-ring" style={{ "--score": `${value * 3.6}deg` } as React.CSSProperties}>
        <div><strong>{value}</strong><span>%</span></div>
      </div>
      <p>{label}</p>
    </div>
  );
}

function TagList({ items, tone = "neutral", empty = "None detected" }: { items: string[]; tone?: string; empty?: string }) {
  if (!items.length) return <p className="empty-copy">{empty}</p>;
  return <div className="tags">{items.map((item) => <span className={`tag ${tone}`} key={item}>{item}</span>)}</div>;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [jd, setJd] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [tailoring, setTailoring] = useState<Tailoring | null>(null);
  const [generated, setGenerated] = useState<Generated | null>(null);
  const [strength, setStrength] = useState("balanced");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(100);

  const acceptedChanges = useMemo(
    () => tailoring?.changes.filter((change) => change.status === "accepted").length || 0,
    [tailoring],
  );

  function chooseFile(next: File | null) {
    setError("");
    if (!next) return;
    if (next.type !== "application/pdf" && !next.name.toLowerCase().endsWith(".pdf")) {
      setError("Choose a PDF file.");
      return;
    }
    if (next.size > 10 * 1024 * 1024) {
      setError("PDFs must be 10 MB or smaller.");
      return;
    }
    setFile(next);
    setAnalysis(null);
    setTailoring(null);
    setGenerated(null);
  }

  async function api<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API}${path}`, options);
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.detail || "Something went wrong. Please retry.");
    }
    return response.json();
  }

  async function analyze() {
    if (!file || jd.trim().length < 80) {
      setError("Add a PDF resume and a job description of at least 80 characters.");
      return;
    }
    setBusy("Reading resume…");
    setError("");
    try {
      const form = new FormData();
      form.append("resume", file);
      form.append("job_description", jd);
      setBusy("Analyzing job and matching experience…");
      const result = await api<Analysis>("/api/analyze", { method: "POST", body: form });
      setAnalysis(result);
      setTailoring(null);
      setGenerated(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setBusy("");
    }
  }

  async function tailor() {
    if (!analysis) return;
    setBusy("Optimizing truthful wording…");
    setError("");
    try {
      const result = await api<Tailoring>("/api/tailor", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: analysis.session_id, strength }),
      });
      setTailoring(result);
      setGenerated(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tailoring failed.");
    } finally {
      setBusy("");
    }
  }

  function updateChange(index: number, patch: Partial<Change>) {
    if (!tailoring) return;
    const changes = tailoring.changes.map((change, i) => i === index ? { ...change, ...patch } : change);
    setTailoring({ ...tailoring, changes });
    setGenerated(null);
  }

  function fitText(index: number) {
    if (!tailoring) return;
    const change = tailoring.changes[index];
    const max = change.original_text.length;
    let fitted = change.replacement_text.trim();
    if (fitted.length > max) {
      fitted = fitted.slice(0, max + 1).replace(/\s+\S*$/, "").replace(/[,:;\s]+$/, "");
    }
    updateChange(index, { replacement_text: fitted, fit_status: "fits" });
  }

  async function generate() {
    if (!analysis || !tailoring) return;
    setBusy("Preserving and validating the original layout…");
    setError("");
    try {
      const result = await api<Generated>("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: analysis.session_id, changes: tailoring.changes }),
      });
      setGenerated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF generation failed.");
    } finally {
      setBusy("");
    }
  }

  const originalPreview = analysis ? `${API}/api/sessions/${analysis.session_id}/original.pdf#page=${page}&zoom=${zoom}` : "";
  const tailoredPreview = generated ? `${API}${generated.preview_url}#page=${page}&zoom=${zoom}` : "";

  return (
    <main>
      <nav className="nav-shell">
        <a className="brand" href="#top" aria-label="ResumeMatch AI home"><span>RM</span>ResumeMatch <b>AI</b></a>
        <div className="trust"><i /> Private by default <span>•</span> Original layout locked</div>
      </nav>

      <section id="top" className="hero">
        <div className="eyebrow"><span>Exact-format tailoring</span><span>Truth-first AI</span></div>
        <h1>Tailor the words.<br /><em>Keep the resume.</em></h1>
        <p>Match a job description without rebuilding your PDF. ResumeMatch AI edits only approved text in place, then verifies the original layout before export.</p>
      </section>

      <section className="workspace-card">
        <div className="input-grid">
          <div className="input-panel">
            <div className="panel-heading"><div><span>01</span><h2>Resume</h2></div><small>PDF · MAX 10 MB</small></div>
            <label
              className={`dropzone ${dragging ? "dragging" : ""} ${file ? "has-file" : ""}`}
              onDragOver={(event: DragEvent) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event: DragEvent) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0]); }}
            >
              <input type="file" accept="application/pdf,.pdf" onChange={(event: ChangeEvent<HTMLInputElement>) => chooseFile(event.target.files?.[0] || null)} />
              <div className="file-icon">PDF</div>
              {file ? <><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(2)} MB · Ready to analyze</span></> : <><strong>Drop your resume here</strong><span>or click to browse</span></>}
            </label>
          </div>

          <div className="input-panel jd-panel">
            <div className="panel-heading"><div><span>02</span><h2>Job description</h2></div><small>{jd.length.toLocaleString()} / 30,000</small></div>
            <textarea value={jd} maxLength={30000} onChange={(event) => { setJd(event.target.value); setAnalysis(null); setTailoring(null); setGenerated(null); }} placeholder="Paste the complete role description, responsibilities, and requirements…" aria-label="Job description" />
          </div>
        </div>
        {error && <div className="alert" role="alert"><strong>Needs attention</strong><span>{error}</span></div>}
        <div className="action-row">
          <p><span>●</span> Files expire automatically after one hour</p>
          <button className="primary" disabled={!!busy || !file || jd.trim().length < 80} onClick={analyze}>{busy || "Analyze resume"}<b>→</b></button>
        </div>
      </section>

      {analysis && (
        <section className="results-section">
          <div className="section-title"><div><span>Analysis</span><h2>Your honest starting point</h2></div><p>{analysis.pages} page{analysis.pages === 1 ? "" : "s"} · {analysis.formatting_confidence}% formatting confidence</p></div>
          {analysis.scanned && <div className="warning">Scanned resume detected. Exact editable formatting may have lower confidence.</div>}
          <div className="analysis-grid">
            <div className="score-card"><ScoreRing value={analysis.original.score} label="Original match" /><div><small>ATS KEYWORD COVERAGE</small><strong>{analysis.original.ats_coverage}%</strong><p>Measured from weighted, evidenced requirements.</p></div></div>
            <div className="keyword-card"><h3>Matched skills <span>{analysis.original.matched_keywords.length}</span></h3><TagList items={analysis.original.matched_keywords} tone="positive" /></div>
            <div className="keyword-card"><h3>Not evidenced <span>{analysis.original.unsupported_keywords.length}</span></h3><TagList items={analysis.original.unsupported_keywords} tone="negative" empty="Every detected requirement has evidence." /><p className="fine-print">These terms will not be inserted without resume evidence.</p></div>
          </div>
          <div className="tailor-bar">
            <div><h3>Ready for precise tailoring</h3><p>Only relevant, supported wording will be proposed.</p></div>
            <div className="strength" role="group" aria-label="Tailoring strength">
              {["conservative", "balanced", "aggressive"].map((option) => <button key={option} className={strength === option ? "active" : ""} onClick={() => setStrength(option)}>{option}</button>)}
            </div>
            <button className="primary" disabled={!!busy || analysis.scanned} onClick={tailor}>{busy || "Tailor resume"}<b>→</b></button>
          </div>
        </section>
      )}

      {analysis && tailoring && (
        <section className="review-section">
          <div className="section-title"><div><span>Review</span><h2>Every change stays yours</h2></div><p>{acceptedChanges} of {tailoring.changes.length} changes accepted</p></div>
          <div className="score-strip">
            <div><small>ORIGINAL MATCH</small><strong>{tailoring.original.score}%</strong></div><span>→</span>
            <div className="accent"><small>PROJECTED MATCH</small><strong>{tailoring.tailored.score}%</strong></div>
            <div><small>SUPPORTED CHANGES</small><strong>{tailoring.changes.filter((change) => change.supported_by_resume).length}</strong></div>
          </div>
          {!tailoring.changes.length ? (
            <div className="no-changes"><h3>No safe wording changes were found</h3><p>The resume can still be exported unchanged. Add an OpenAI API key for deeper, structured rewriting, or keep this truthful baseline.</p></div>
          ) : (
            <div className="changes-list">
              {tailoring.changes.map((change, index) => {
                const ratio = change.replacement_text.length / Math.max(1, change.original_text.length);
                const fit = ratio <= 1.03 ? "fits" : ratio <= 1.18 ? "tight" : "overflow";
                return <article className={`change-card ${change.status}`} key={change.id}>
                  <header><div><span>{change.section}</span><p>{change.reason}</p></div><div className="decision"><button className={change.status === "accepted" ? "selected" : ""} onClick={() => updateChange(index, { status: "accepted" })}>Accept</button><button className={change.status === "rejected" ? "selected reject" : ""} onClick={() => updateChange(index, { status: "rejected" })}>Reject</button></div></header>
                  <div className="change-grid"><div><small>ORIGINAL</small><p>{change.original_text}</p></div><div><small>TAILORED · EDITABLE</small><textarea value={change.replacement_text} onChange={(event) => updateChange(index, { replacement_text: event.target.value })} /></div></div>
                  <footer><TagList items={change.jd_keywords} tone="positive" /><div className={`fit ${fit}`}>{fit === "fits" ? "Fits original region" : fit === "tight" ? "Fit is tight" : "May not fit"}{fit !== "fits" && <button onClick={() => fitText(index)}>Fit text</button>}</div></footer>
                </article>;
              })}
            </div>
          )}
          <div className="generate-row"><div><strong>Layout lock runs before export</strong><span>Page size, page count, fit, fonts, and alignment are checked.</span></div><button className="primary" disabled={!!busy} onClick={generate}>{busy || "Generate final PDF"}<b>→</b></button></div>
        </section>
      )}

      {analysis && generated && (
        <section className="preview-section">
          <div className="section-title"><div><span>Final</span><h2>Verified side by side</h2></div><a className="download" href={`${API}${generated.download_url}`}>Download PDF ↓</a></div>
          <div className="metrics">
            <div><small>JD MATCH</small><strong>{generated.tailored.score}%</strong></div>
            <div><small>LAYOUT PRESERVATION</small><strong>{generated.layout.score}%</strong></div>
            <div><small>ATS COVERAGE</small><strong>{generated.tailored.ats_coverage}%</strong></div>
            <div><small>PAGE PRESERVATION</small><strong>{generated.layout.page_preservation}%</strong></div>
          </div>
          <div className="preview-toolbar"><div><button disabled={page <= 1} onClick={() => setPage(Math.max(1, page - 1))}>←</button><span>Page {page} of {analysis.pages}</span><button disabled={page >= analysis.pages} onClick={() => setPage(Math.min(analysis.pages, page + 1))}>→</button></div><div><button onClick={() => setZoom(Math.max(60, zoom - 10))}>−</button><span>{zoom}%</span><button onClick={() => setZoom(Math.min(160, zoom + 10))}>+</button></div></div>
          <div className="pdf-grid"><div><h3>Original resume <span>Visual master</span></h3><iframe key={originalPreview} title="Original resume PDF" src={originalPreview} /></div><div><h3>Tailored resume <span>Layout locked</span></h3><iframe key={tailoredPreview} title="Tailored resume PDF" src={tailoredPreview} /></div></div>
        </section>
      )}

      <footer className="site-footer"><div className="brand"><span>RM</span>ResumeMatch <b>AI</b></div><p>Truthful tailoring. Original-format fidelity. No permanent resume storage.</p></footer>
    </main>
  );
}
