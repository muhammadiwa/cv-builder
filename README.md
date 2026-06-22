# CV ATS Builder

> An open-source, AI-powered CV builder with 16 ATS-optimized templates, automated job-description matching, and PDF export. Built for engineers who care about clean output and honest scoring.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![React 18](https://img.shields.io/badge/react-18-61dafb.svg)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg)](https://fastapi.tiangolo.com/)
[![Tests](https://img.shields.io/badge/tests-110%20passing-brightgreen.svg)](#testing)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

---

## ✨ Features

- **16 ATS-safe CV templates** — visually distinct layouts built on a frozen 7-axis configuration model (4 structural + 3 decoration). Pure-CSS schematics, zero external assets.
- **AI-powered job matching** — paste a job description, get an honest, evidence-based match score with 8-component breakdown. No fabricated claims, no "H1B Sponsor Likely" nonsense.
- **PDF export** — selectable text (ATS-readable), not scanned images. Powered by WeasyPrint.
- **Multi-format import** — upload existing CVs in PDF, DOCX, or TXT and parse structured data automatically.
- **Multi-provider LLM** — pluggable abstraction over OpenAI, Anthropic, and local providers. Configure per-task models from the Settings page.
- **Job tracker** — paste URLs, auto-scrape with `selectolax`, monitor application status across the pipeline.
- **Cover letters** — AI-generated, tailored to each job description, evidence-grounded.
- **Honest scoring** — every match component is either computed or explicitly "N/A" — no fake confidence numbers.

---

## 🖼️ Screenshots

_Coming soon — the app currently lives at `localhost:5173` with no hosted demo._

| Jobs page with match scoring | CV templates gallery |
|------------------------------|----------------------|
| _Add screenshots here_       | _Add screenshots here_ |

---

## 🏗️ Architecture

```
cv-ats-builder/
├── backend/          FastAPI + SQLAlchemy + SQLite
│   ├── app/
│   │   ├── api/routes/      REST endpoints (jobs, cvs, templates, matches, ...)
│   │   ├── core/            Config, security, LLM provider abstraction
│   │   ├── db/              SQLAlchemy session + init
│   │   ├── llm/             Provider clients (OpenAI, Anthropic, ...)
│   │   ├── models/          ORM models
│   │   ├── schemas/         Pydantic request/response models
│   │   └── services/        Business logic (scoring, scraping, rendering, ...)
│   ├── tests/        110+ pytest tests
│   └── dev.db        Local SQLite (auto-created)
└── frontend/         Vite + React 18 + TypeScript + Tailwind
    ├── src/
    │   ├── components/      UI primitives + feature components
    │   ├── pages/           Route components (Dashboard, Jobs, Templates, ...)
    │   ├── lib/             API client + utilities
    │   └── types/           Shared TypeScript types
    └── public/       Static assets
```

### Why this stack?

- **FastAPI** — async-native, automatic OpenAPI docs, excellent type hints.
- **SQLAlchemy 2.0** — clean async ORM, future-proof migration path.
- **SQLite by default** — zero-config local dev. Swap to Postgres via `DATABASE_URL`.
- **React + Vite** — fast HMR, no webpack config to maintain.
- **Tailwind** — design tokens centralized, easy to enforce consistency.

---

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Node.js 20+
- (Optional) `libpango`, `libcairo`, `libgdk-pixbuf` for WeasyPrint PDF rendering:
  ```bash
  # Ubuntu/Debian
  sudo apt install libpango-1.0-0 libpangoft2-1.0-0 libcairo2 libgdk-pixbuf2.0-0

  # macOS
  brew install pango cairo gdk-pixbuf libffi
  ```

### 1. Clone & install

```bash
git clone https://github.com/muhammadiwa/cv-builder.git
cd cv-builder
```

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Initialize DB + seed templates (runs once)
python -m app.db.init
python -m app.db.seed_templates

# Start dev server
uvicorn app.main:app --reload --port 8765
```

Backend now live at **http://localhost:8765** — OpenAPI docs at `/docs`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend now live at **http://localhost:5173**.

### 4. Configure an LLM provider (optional, for AI features)

The app runs without LLM keys, but scoring, cover letters, and CV enhancement won't work. From the **Settings** page, add an API key for OpenAI or Anthropic. Keys are encrypted at rest with Fernet.

Or via env var:

```bash
# .env
OPENAI_API_KEY=sk-...
# or
ANTHROPIC_API_KEY=sk-ant-...
```

---

## 🧪 Testing

```bash
cd backend
pytest                    # all tests
pytest -k cv_renderer     # one module
pytest --cov=app          # with coverage
```

Current status: **110+ tests passing** across scoring, rendering, scraping, parsing, and API routes.

---

## 🛣️ Roadmap

This is an MVP. Direction is driven by what job-seekers actually need.

- [ ] Docker Compose for one-command setup
- [ ] Multi-language CV support (i18n)
- [ ] Browser extension for one-click "Apply on this site"
- [ ] Job application kanban (Applied → Interview → Offer)
- [ ] Local LLM support via Ollama (fully offline scoring)
- [ ] Public template gallery with community submissions
- [ ] Webhook integrations (Greenhouse, Lever, Workday)

See [open issues](https://github.com/muhammadiwa/cv-builder/issues) for the full backlog.

---

## 🤝 Contributing

PRs welcome. The bar is high — we care about correctness more than velocity.

1. Fork & create a branch from `main`.
2. Make your change. Add tests if it's a feature or bugfix.
3. Run `pytest` + `npm run typecheck`. Both must pass clean.
4. Open a PR. Include a short description of *why*, not just *what*.

### Good first issues

Check the [`good first issue`](https://github.com/muhammadiwa/cv-builder/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) label.

### Code of conduct

Be kind. We're all here to ship something useful, not to win arguments.

---

## 📜 License

[MIT](LICENSE) — do whatever you want, just don't blame us if it breaks.

---

## 🙏 Acknowledgments

- ATS-safety research distilled from years of recruiter forum complaints.
- Template design inspired by [JSON Resume](https://jsonresume.org/) and the [Reactive Resume](https://rxresu.me/) project.
- Match-scoring approach informed by [Jobright AI](https://jobright.ai/) (without the vendor lock-in).

---

<p align="center">
  <sub>Built by <a href="https://github.com/muhammadiwa">@muhammadiwa</a> and contributors.</sub>
</p>