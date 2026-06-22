# Contributing to CV ATS Builder

Thanks for being here. PRs are welcome — the bar is high, but the process is short.

## Philosophy

- **Correctness over velocity.** We'd rather a smaller, well-tested feature than a bigger, flaky one.
- **Honest output over impressive output.** Match scores, parsed fields, AI suggestions — all of them must reflect what's actually in the data. No fabricated confidence.
- **Small PRs, clear rationale.** A reviewer should understand *why* before they read *what*.

---

## Getting set up locally

See [README.md → Quick Start](README.md#-quick-start). The TL;DR:

```bash
git clone https://github.com/muhammadiwa/cv-builder.git
cd cv-builder

# Backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m app.db.init && python -m app.db.seed_templates
uvicorn app.main:app --reload --port 8765 &

# Frontend
cd ../frontend && npm install && npm run dev
```

---

## Finding something to work on

- [`good first issue`](https://github.com/muhammadiwa/cv-builder/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) — small, well-scoped tasks for first-time contributors.
- [`help wanted`](https://github.com/muhammadiwa/cv-builder/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22) — bigger or more ambiguous tasks.
- [`bug`](https://github.com/muhammadiwa/cv-builder/issues?q=is%3Aissue+is%3Aopen+label%3A%22bug%22) — confirmed bugs.

If your idea isn't tracked, **open an issue first** before sending a PR. Saves everyone time.

---

## Development workflow

### 1. Branch

Branch off `main` with a descriptive name:

```bash
git checkout main
git pull
git checkout -b fix/cover-letter-line-wrap
# or
git checkout -b feat/scoring-rubric-versioning
```

### 2. Make your change

- Keep commits small and atomic.
- Write code that reads like prose. If you need comments to explain *what* it does, refactor first.
- Match the style of the surrounding file. The codebase is opinionated — be consistent with it.

### 3. Test

Before pushing:

```bash
# Backend
cd backend
pytest                                    # all tests must pass
pytest tests/test_<your_module>.py -v     # your test specifically
ruff check app/                           # if ruff is configured

# Frontend
cd frontend
npm run typecheck                         # tsc must be clean
npm run lint                              # eslint must be clean
npm run build                             # production build must succeed
```

Both `npm run typecheck` and `pytest` are gates. CI runs them on every PR.

### 4. Document

- New feature → update README + add a code comment if the *why* is non-obvious.
- New API endpoint → add a docstring with request/response examples.
- Behavior change → note it in your PR description under "Breaking changes:" if applicable.

### 5. Commit & push

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add proficiency slider to skills section
fix: cover letter generator hangs on empty JD
docs: clarify WeasyPrint system dependencies
refactor: split cv_renderer into structural + decoration passes
test: cover matcher fallback when LLM provider is unavailable
chore: bump fastapi to 0.116
```

Push and open a PR.

### 6. Open a PR

PR description should answer three questions:

1. **What** changed?
2. **Why** is this needed?
3. **How** was it tested?

If your PR closes an issue, use `Closes #123` so GitHub auto-links and auto-closes.

A maintainer will review within a few days. Expect questions — that's normal and good.

---

## Code style

### Python (backend)

- Python 3.11+, async-first where applicable.
- Type hints on all public functions. Internal helpers can be lax, but if you're reading them later you should still know the types.
- `pydantic` for all input/output validation. Don't roll your own.
- Prefer pure functions in `services/` — they're easier to test.
- Test file naming: `test_<module>.py` in `backend/tests/`.

### TypeScript (frontend)

- React 18, function components, hooks only.
- Strict TypeScript. `any` is a code smell; justify it if you need it.
- Tailwind only — no separate CSS files unless the pattern is reusable.
- Component naming: `PascalCase.tsx`. Hooks: `useCamelCase.ts`. Types: `camelCase.ts`.
- Co-locate small components with their page; promote to `src/components/` only when reused.

### Templates

Template configurations follow the **7-axis frozen model** (4 structural + 3 decoration + skills extensions). Don't add new axes without a discussion in an issue first — it invalidates all 16 seeded templates.

---

## Reporting bugs

Open an issue with:

1. **What you expected** vs **what happened**.
2. **Steps to reproduce** (copy-pasteable).
3. **Environment**: OS, Python version, Node version, browser (if FE).
4. **Logs / screenshots** if relevant.

If the bug is a security issue, see [SECURITY.md](SECURITY.md) (or email the maintainer directly) instead of opening a public issue.

---

## Suggesting features

Open an issue with:

1. **The problem** you're trying to solve, not just the solution.
2. **Who** else would benefit.
3. **Alternatives** you've considered.

We say "no" to a lot of features to keep the project focused. Don't take it personally.

---

## Code of conduct

Be kind. We're all here to ship something useful, not to win arguments.

Harassment, doxxing, or abusive behavior → instant ban, no appeal.

---

## License

By contributing, you agree your contributions will be licensed under the [MIT License](LICENSE).