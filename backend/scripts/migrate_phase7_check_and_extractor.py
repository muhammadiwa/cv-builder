"""Manual migration — apply ALTER TABLE statements to bring the dev DB
in sync with the current ORM models.

Three things are pending:

1. Phase 4 retro fix: ``Job.extractor_used`` column was added to
   models.Job but never had a corresponding ALTER TABLE applied to
   the existing dev DB. Queries against ``jobs`` therefore error with
   "no such column: jobs.extractor_used".

2. Phase 7.5 fix: ``CVDraft.score`` and ``CVVersion.score`` now have
   CHECK constraints (``score >= 0 AND score <= 1``) at the ORM level
   for new installs; this migration backfills the constraint onto the
   existing dev DB so the defense-in-depth catches bad writes there
   too.

3. Phase 8 fix: SQLAlchemy's ``use_alter=True`` / deferred-FK
   machinery for the ``exports.cover_letter_id`` column produced an
   ``exports`` table with a literal FK to ``cover_letters_tmp(id)``.
   SQLite's "deferred FK via shadow table" hack needs that table to
   exist for inserts to succeed. The cover_letters table is a future-
   Phase model so we don't have real cover letter rows yet — create
   an empty shadow table so the constraint trivially passes for CV
   exports (where ``cover_letter_id`` is always NULL anyway).

Run with::

    /tmp/jfvenv/bin/python -m scripts.migrate_phase7_check_and_extractor

Re-runnable: each statement is wrapped in try/except so re-running
after a successful apply is a no-op.
"""
from __future__ import annotations

import sqlite3
import sys
from pathlib import Path


def main() -> int:
    # Resolve the dev DB path. The engine points at storage/cv_builder.db
    # by default; fall back to that if DATABASE_URL is unset.
    db_path = Path(__file__).resolve().parent.parent / "storage" / "cv_builder.db"
    if not db_path.exists():
        print(f"dev DB not found at {db_path}", file=sys.stderr)
        return 1

    print(f"applying migration to {db_path}")
    con = sqlite3.connect(str(db_path))
    cur = con.cursor()

    statements = [
        # Phase 4 retro: Job.extractor_used.
        ("ALTER TABLE jobs ADD COLUMN extractor_used VARCHAR(50)",
         "jobs.extractor_used"),
        # Phase 7 B11: CVDraft + CVVersion score CHECK.
        ("CREATE TRIGGER IF NOT EXISTS cv_drafts_score_check "
         "BEFORE INSERT ON cv_drafts "
         "FOR EACH ROW WHEN NEW.score < 0 OR NEW.score > 1 "
         "BEGIN SELECT RAISE(ABORT, 'cv_drafts.score out of range'); END;",
         "cv_drafts score CHECK trigger"),
        ("CREATE TRIGGER IF NOT EXISTS cv_drafts_score_update_check "
         "BEFORE UPDATE ON cv_drafts "
         "FOR EACH ROW WHEN NEW.score < 0 OR NEW.score > 1 "
         "BEGIN SELECT RAISE(ABORT, 'cv_drafts.score out of range'); END;",
         "cv_drafts score UPDATE CHECK trigger"),
        ("CREATE TRIGGER IF NOT EXISTS cv_versions_score_check "
         "BEFORE INSERT ON cv_versions "
         "FOR EACH ROW WHEN NEW.score < 0 OR NEW.score > 1 "
         "BEGIN SELECT RAISE(ABORT, 'cv_versions.score out of range'); END;",
         "cv_versions score CHECK trigger"),
        ("CREATE TRIGGER IF NOT EXISTS cv_versions_score_update_check "
         "BEFORE UPDATE ON cv_versions "
         "FOR EACH ROW WHEN NEW.score < 0 OR NEW.score > 1 "
         "BEGIN SELECT RAISE(ABORT, 'cv_versions.score out of range'); END;",
         "cv_versions score UPDATE CHECK trigger"),
        # Phase 8: shadow table SQLAlchemy uses for the deferred FK
        # from exports.cover_letter_id. Real CoverLetter table doesn't
        # exist yet (Phase 9+); the shadow makes inserts work for CV
        # exports where cover_letter_id is always NULL.
        ("CREATE TABLE IF NOT EXISTS cover_letters_tmp ("
         "id VARCHAR(36) PRIMARY KEY)",
         "cover_letters_tmp shadow table"),
    ]

    for sql, label in statements:
        try:
            cur.execute(sql)
            print(f"  OK: {label}")
        except sqlite3.OperationalError as e:
            # Idempotent: column already exists or trigger already present.
            if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
                print(f"  skip: {label} (already applied)")
                continue
            print(f"  FAIL: {label} -> {e}", file=sys.stderr)
            con.rollback()
            return 2

    con.commit()
    con.close()
    print("migration complete")
    return 0


if __name__ == "__main__":
    sys.exit(main())