# 📋 Job Copier & CV Agent — v1.4.1

A Chrome/Brave extension combined with a local pipeline to capture job offers and generate a tailored CV — via Claude Code skills running on your Claude Pro subscription, not a billed API call.

---

## 🆕 Changelog

### v1.4.1
- Multi-site capture completed — LinkedIn, Welcome to the Jungle and HelloWork selectors added (all 5 sites now configured)
- LinkedIn has no stable DOM selector for title/company — falls back to parsing `document.title`
- CV generation moved from a direct Anthropic API call (`api/agent.py`, unused) to two independent Claude Code skills running on the Claude Pro subscription (no per-call billing)
- Two CV formats, generated and tracked independently: short CV (`generate-cv`, 1-2 pages) and detailed CV (`generate-detailled-cv`, 2 pages)
- PDF generation active by default — Playwright/Chromium for the short CV (multi-page pagination via `template/pagination.js`), WeasyPrint for the detailed CV
- LinkedIn intelligence tooling (`tools/linkedin-mcp/`) — expert-profile mission scraping, hard-skill coverage tracking, tailored CV experience drafting from real missions (see Epic 2 in `_bmad-output/planning-artifacts/epics.md`)

### v1.0.0
- Multi-site support (Indeed, LinkedIn, Welcome to the Jungle, HelloWork, Free-Work)
- Keyboard shortcut (`Ctrl+Shift+M` / `Cmd+Shift+M`)
- Floating visual button on job pages
- Copy confirmation notification
- Automatic site detection
- SPA support via MutationObserver

---

## 📋 Features

- ✅ **Multi-site capture** — Indeed, LinkedIn, Welcome to the Jungle, HelloWork, Free-Work (all configured)
- ✅ **Keyboard shortcut** (`Ctrl+Shift+M` / `Cmd+Shift+M` on Mac)
- ✅ **Visual copy button** on supported pages
- ✅ **Structured JSON payload** sent to a local FastAPI webhook — stored with status `captured`, no LLM call at capture time
- ✅ **Skill-based CV generation** — a Claude Code skill (`generate-cv` / `generate-detailled-cv`) reasons over each pending offer and produces a JSON patch, applied deterministically by a Python script (no separate LLM API call, runs on Claude Pro)
- ✅ **Two independent CV formats** — short (only offer-relevant skills shown) and detailed (broad inventory, trimmed to what's relevant), separate output paths and DB columns
- ✅ **ATS optimization** — exact keywords from the offer injected into the CV
- ✅ **PDF generation** — Playwright (short CV, paginated) / WeasyPrint (detailed CV)
- ✅ **Application CRM** — PostgreSQL tracking (`captured → generated → sent → no_response / positive / negative / interview`)
- ✅ **LinkedIn intelligence tooling** — mission corpus scraping, hard-skill coverage table, CV experience drafting from real missions (`tools/linkedin-mcp/`, see `.claude/skills/lk-*` and `generate-mission-cv`)

---

## 🎯 Supported Job Boards

All 5 sites are configured. Selectors are duplicated between `extension/content.js` (`config.siteSelectors`, floating button → webhook) and `extension/background.js` (`siteSelectors`, `Ctrl+Shift+M` → clipboard only) and must be kept in sync — see `extension/AGENTS.md`.

| Site | Header/title selector | Notes |
|------|------------------------|-------|
| Indeed | `.jobsearch-InfoHeaderContainer` | |
| Free-Work | `header.bg-primary` | Also extracts structured skill tags |
| Welcome to the Jungle | `[data-testid="job-metadata-block"]` | Also extracts structured skill tags |
| HelloWork | `h1#main-content` | |
| LinkedIn | _none — no stable DOM selector exists_ | Title/company parsed from `document.title` (`"{Title} \| {Company} \| ... \| LinkedIn"`) |

---

## 🏗️ Project Structure

```
.
├── docker-compose.yml
├── .env
├── README.md
│
├── extension/                        # Chrome/Brave extension (Manifest V3)
│   ├── manifest.json
│   ├── background.js                 # Ctrl+Shift+M shortcut, clipboard only
│   ├── content.js                    # Floating button, sends to webhook
│   ├── popup.html / popup.js
│   └── icons/
│
├── api/                              # FastAPI backend + CV generation scripts
│   ├── main.py                       # FastAPI routes + /webhook
│   ├── pending_offers.py             # CLI script — lists offers pending generation (used by the skills)
│   ├── offer_by_id.py                # CLI script — same, targeting one application
│   ├── finalize_cv.py                # CLI script — applies the patch, writes HTML+PDF, updates status
│   ├── html_patcher.py               # HTML patching (BeautifulSoup)
│   ├── agent_court.md / agent_detaille.md  # Rules read by the two CV skills
│   ├── agent.py                      # Direct Anthropic API call — built & tested, unused by the current flow
│   ├── models.py / database.py       # SQLAlchemy models + async DB connection
│   └── tests/                        # pytest
│
├── template/                         # CV HTML/CSS templates
│   ├── my_template_cv_court.html / my_template_cv_detaille.html   # Personal (gitignored)
│   ├── template_cv_court.html / template_cv_detaille.html         # Generic, committable counterparts
│   ├── hard_skills.html              # Single source of truth for injectable skills
│   └── pagination.js                 # Playwright-driven pagination for the short CV
│
├── tools/linkedin-mcp/                # LinkedIn intelligence data (gitignored — session/cookie data)
│
├── .claude/skills/                   # generate-cv, generate-detailled-cv, generate-mission-cv, lk-*
├── output/                           # Generated HTML CVs
└── pdf/                              # Generated PDFs
```

---

## 🚀 Getting Started

### Prerequisites

- Docker + Docker Compose
- Chrome or Brave browser
- [Claude Code](https://claude.com/claude-code) with an active Claude Pro/Max subscription — the CV generation skills run inside a Claude Code session, not via a billed API call

### 1. Configure environment

```bash
cp .env.example .env
# Edit .env — set POSTGRES_*, PGADMIN_*, CANDIDATE_SLUG
# ANTHROPIC_API_KEY is only used by the unused api/agent.py path — not required for the current skill-based flow
```

### 2. Start Docker services

```bash
docker compose up --build
```

Services available:
- API: `http://localhost:9000`
- pgAdmin: `http://localhost:5050`

### 3. Load the extension

1. Open `brave://extensions/` or `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `extension/` folder

No hot-reload — reload the extension after every change to `content.js`/`background.js`.

---

## 🎮 Usage

1. Navigate to a job offer on a supported site
2. Click **"📋 Copier l'offre"** or press `Ctrl+Shift+M`
3. The offer is copied to clipboard and (via the floating button) sent to the local webhook — stored with status `captured`, no CV generated yet
4. In a Claude Code session, ask for the CV: "génère le CV" (short) or "génère le CV détaillé" (detailed) — invokes the corresponding skill, which fetches pending offers, reasons over each one, and writes HTML + PDF to `output/`/`pdf/`
5. Track your application via the API at `http://localhost:9000/applications`

---

## 📊 CRM API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhook` | Receive a captured job offer (status → `captured`) |
| GET | `/applications` | List all applications |
| GET | `/applications/{id}` | Application detail |
| PATCH | `/applications/{id}/status` | Update status |
| GET | `/stats` | Response rate & stats |

`pending_offers.py`/`offer_by_id.py`/`finalize_cv.py` are **not** HTTP endpoints — they're CLI scripts invoked by the Claude Code skills via `docker compose exec api python <script>.py`.

### Application statuses
`captured` → `generated` → `sent` → `no_response` / `positive` / `negative` / `interview`

---

## 🛠️ Technologies

**Extension:** JavaScript, Chrome Manifest V3, MutationObserver, Clipboard API

**Backend:** FastAPI, SQLAlchemy (async), PostgreSQL, Alembic, BeautifulSoup4

**CV generation:** Claude Code skills (Claude Pro subscription — no billed API calls in the current flow)

**PDF:** Playwright/Chromium (short CV), WeasyPrint (detailed CV)

**Infrastructure:** Docker, Docker Compose, pgAdmin

---

## ⚠️ Disclaimer

This tool is designed for personal productivity. It does not collect any external data and runs entirely locally. Copying job descriptions should respect the terms of service of each job board.

---

**Built to maximize your ATS score and streamline your job application process** 🎯
