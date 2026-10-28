# Krutik Patel — Portfolio v2 (October 28, 2026)

## Live deployment
- Public URL: https://krutik-patel-portfolio.vercel.app/
- Vercel owner workspace: Shubh (user account)
- Existing Vercel project: krutik-patel-portfolio
- Project ID: prj_jtlIs3eJQKsdIJnO4A6shzunbEuE
- Production deployment ID: dpl_55YQDjPe5RiEPj6KrnLkNh7LxAbR
- Deployment status: READY, production HTTP 200 verified October 28, 2026.

## Source
- This branch only: `sphacker007/ResumeMatchAI`, branch `krutik-portfolio-source`, path `krutik-portfolio/index.html`.
- This is a **standalone, static HTML/CSS/JS site** currently deployed directly through Vercel's deployment API. It is NOT connected to GitHub auto-deploy.
- DO NOT merge this temporary portfolio branch into the unrelated ResumeMatchAI main branch.
- On future setup, create a dedicated `sphacker007/krutik-patel-portfolio` repository and connect it to the **existing** Vercel project, not a new project. Do not use Krutik's GitHub or Vercel account.

## Design & functionality
- Dark astronomical backdrop with fixed slowly animated starfield.
- New split-layout hero with rotating 3D canvas neural core, responsive title and two functional CTAs.
- Philosopy heading with progressive gray-to-white/blue word-by-word scroll reveal.
- Smooth anchored navigation, progress indicator, animated technology marquee.
- Exactly four real projects, each a single clickable card opening the original public GitHub repo in a new tab:
  1. https://github.com/krutik-hub/Healthy-Heart
  2. https://github.com/krutik-hub/IMS
  3. https://github.com/krutik-hub/invoicepro-saas
  4. https://github.com/krutik-hub/Talvix
- Each project description is grounded in repository content. Interface illustrations inside project cards are decorative mockups, not actual screenshots or verified live statistics.
- Eight expertise rows, each triggering a left-to-right neon line sweep as it enters view. Decorative arrows removed.
- Impact numbers 15K+, 40%, 96%, 25% animate from 0 to target on entry.
- Expanded professional experience, education and certifications grounded in the resume.
- Contact details: pkrutik154@gmail.com and +1 (682) 412-0405, matching user's October 28 resume.
- Email CTA uses mailto, phone uses tel link, LinkedIn and GitHub use clickable URLs.
- Responsive CSS and prefers-reduced-motion support.

## QA
Preview deployment: dpl_AWJju4szw3zoE8vD4fBxp8oQ4gHi
Production deployment: dpl_BLwNTjmeqXfWTXJnCs4qGng8dH4a
Verified static source structure, 14 internal anchors (none broken), 4 project GitHub links, 8 expertise rows, 4 count-up values, all contact details, JavaScript syntax via node --check, live HTTP 200, Vercel READY and no alias errors.
Visual browser-level animation comparison was not run in automated QA.

## Contact polish and browser branding (October 28, 2026)
- Three icon-labelled social CTAs: Email (Gmail browser compose), GitHub, and LinkedIn. All URLs use Krutik's public profile/contact, not portfolio-owner credentials.
- Email compose opens in a new browser tab with recipient `pkrutik154@gmail.com`; fallback `Copy email` control uses Clipboard API and a legacy selection fallback.
- Footer button copies the exact URL `https://krutik-patel-portfolio.vercel.app/`, without ChatGPT query parameters.
- Site provides `<link rel="canonical">` for the clean address and serves a custom `/favicon.svg` KP monogram, verified MIME `image/svg+xml` with HTTP 200.
- New production deployment `dpl_55YQDjPe5RiEPj6KrnLkNh7LxAbR`, status READY and verified public URL, favicon, all social buttons, content anchors and all project links.
- This is a static source update only. It does not connect GitHub CI/CD. Gmail compose may ask a visitor to sign in if not already using Gmail.
