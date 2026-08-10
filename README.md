# ResumeMatch AI

ResumeMatch AI is a truth-first resume tailoring application that edits selected text directly inside an uploaded PDF. The uploaded document remains the visual master: unaffected PDF content is never rebuilt into a generic template.

## What it does

- Upload a text-based PDF resume and paste a job description.
- Extract text with page numbers, coordinates, fonts, sizes, colors, lines, and inferred sections.
- Parse weighted job requirements and match semantic aliases such as AWS/Amazon Web Services and Postgres/PostgreSQL.
- Report matched, missing, and unsupported requirements without inventing experience.
- Propose only supported, minimal changes through a server-side AI provider or a deterministic alias-normalization fallback.
- Accept, reject, or manually edit each proposed change.
- Redact only the original text rectangle and insert the approved replacement into collision-aware space on the same line.
- Preserve embedded fonts when they can be extracted; otherwise use the closest PDF base font.
- Reject output that changes page dimensions/count, overflows, or scores below 98 for layout preservation.
- Preview original and tailored PDFs side by side and download a searchable PDF.

## Architecture

```text
Browser
  -> Next.js / React / TypeScript frontend on Vercel
  -> FastAPI service
       -> PyMuPDF coordinate extraction
       -> deterministic JD + matching engine
       -> AIProvider abstraction (OpenAI Responses API when configured)
       -> in-place PDF editor
       -> layout guard
       -> temporary one-hour session storage
```

The frontend uses standard Next.js and is configured for native Vercel deployment. The Python backend is container-ready for Render, Railway, Fly.io, or another service with a persistent process and enough memory for PyMuPDF. Keeping the PDF engine outside a constrained frontend function avoids weakening format preservation.

## Repository structure

```text
app/                     Product interface
public/                  Static assets and social card
backend/app/main.py      FastAPI routes
backend/app/models.py    Validated API and AI contracts
backend/app/services/    PDF, matching, tailoring, and layout modules
backend/tests/           Generated-resume acceptance tests
output/pdf/              Local proof-of-concept PDFs (gitignored)
```

## Local setup

Requirements: Node.js 22+, pnpm 11+, and Python 3.12.

### Frontend

```bash
pnpm install
copy .env.example .env.local
pnpm dev
```

The frontend runs at `http://localhost:3000`.

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

On macOS/Linux, activate or invoke `.venv/bin/python` instead. The API runs at `http://localhost:8000`.

## Environment variables

| Variable | Location | Required | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Frontend | Yes in production | Public HTTPS URL of the FastAPI service |
| `OPENAI_API_KEY` | Backend only | No | Enables structured AI rewriting; never expose it to the browser |
| `OPENAI_MODEL` | Backend only | No | Defaults to `gpt-5.6-terra` |
| `ALLOWED_ORIGINS` | Backend | Yes in production | Comma-separated frontend origins allowed by CORS |

Without `OPENAI_API_KEY`, analysis, scoring, PDF generation, preview, and download remain functional. Tailoring uses conservative, evidence-backed terminology normalization. With a key, the OpenAI provider makes one structured Responses API request and validates the result before any PDF edit.

## Testing and verification

```bash
cd backend
.venv\Scripts\python -m pytest -q
cd ..
pnpm lint
node_modules\.bin\tsc.cmd --noEmit
pnpm build
```

The backend suite creates a dummy resume and verifies:

- coordinate-aware extraction and section detection;
- JD parsing and semantic skill aliases;
- strict request/response validation;
- same page count and dimensions;
- searchable replacement text;
- unchanged identity and unrelated content;
- overflow detection and rejection;
- layout preservation score of at least 98;
- API upload, tailoring, generation, and download.

Rendered proof files are written locally to `output/pdf/` during the acceptance workflow and intentionally ignored by Git.

## PDF preservation strategy

1. PyMuPDF extracts each line with page, bounding rectangle, font, font size, and color.
2. Protected lines (contact details, employers/dates, and education) are excluded from automatic changes.
3. Replacements are length-constrained and mapped back to a specific source region.
4. Only that source rectangle is redacted with a transparent fill, preserving backgrounds and graphics.
5. The editor reuses an embedded font where extractable, retains the original size, and allows at most 0.5 pt automatic reduction.
6. Horizontal expansion is allowed only through collision-free whitespace inside the page's existing content boundary.
7. The layout guard measures page geometry, font reuse/size, fit, alignment, and overflow. A score below 98 is not downloadable.

## Security and privacy

- PDF MIME, header, encryption, page count, and 10 MB size limits are validated.
- Job descriptions are limited to 30,000 characters.
- Resume and JD text are explicitly treated as untrusted data in AI prompts.
- API keys stay server-side.
- CORS is allow-listed and a basic per-IP request limit is applied.
- Filenames are sanitized.
- Sessions and files expire from temporary storage after one hour and are not persisted by default.
- OpenAI requests use `store: false`.

## Deployment

### Backend (Render Blueprint)

1. Push the repository to GitHub.
2. Create a Render Blueprint from `render.yaml`.
3. Set `OPENAI_API_KEY` if AI rewriting is desired.
4. Set `ALLOWED_ORIGINS` to the final frontend origin.
5. Confirm `https://<backend>/health` returns `{ "status": "ok" }`.

### Frontend

Create or import the `resume-match-ai` project in Vercel with the repository root as the project root, framework preset `Next.js`, install command `pnpm install --frozen-lockfile`, and build command `pnpm run build`. Set `NEXT_PUBLIC_API_URL` to the deployed HTTPS backend URL for production and preview. Use `main` as the production branch so future pushes trigger deployments automatically. Do not move PyMuPDF into a short-lived serverless function.

## Known limitations

- Exact editing requires a digitally created, text-selectable PDF. Scanned resumes are detected and blocked from low-confidence reconstruction; OCR is not yet enabled.
- Complex subset fonts can occasionally prevent exact font reuse; the nearest base font is used and reported in the font score.
- Manual replacement text can still be semantically untruthful. The UI warns about physical fit, while the user remains responsible for manual content accuracy.
- Highly decorative text rendered as vector paths cannot be edited as text.
- Temporary sessions are process-local; production horizontal scaling needs a shared ephemeral store.

## AI implementation note

The OpenAI integration is isolated behind `AIProvider`, uses the Responses API, requests strict JSON Schema output, validates it with Pydantic, sends extracted text instead of the full PDF, and makes a second request only when a future repair path requires it. Official guidance recommends the Responses API for current reasoning workflows and structured schema output for reliable machine-readable results.
