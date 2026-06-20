"""Manual migration — apply ALTER TABLE statements to bring the dev DB
in sync with the current ORM models.

Five things are pending:

1. Phase 4 retro fix: ``Job.extractor_used`` column was added to
   models.Job but never had a corresponding ALTER TABLE applied to
   the existing dev DB. Queries against ``jobs`` therefore error with
   "no such column: jobs.extractor_used".

2. Phase 7.5 fix: ``CVDraft.score`` and ``CVVersion.score`` now have
   CHECK constraints (``score >= 0 AND score <= 1``) at the ORM level
   for new installs; this migration backfills the constraint onto the
   existing dev DB so the defense-in-depth catches bad writes there
   too. Phase 8.5 fix: clamps existing rows BEFORE adding triggers
   so legacy out-of-range scores don't crash subsequent writes.

3. Phase 8 fix: SQLAlchemy's ``use_alter=True`` / deferred-FK
   machinery for the ``exports.cover_letter_id`` column produced an
   ``exports`` table with a literal FK to ``cover_letters_tmp(id)``.
   SQLite's "deferred FK via shadow table" hack needs that table to
   exist for inserts to succeed. The cover_letters table is a future-
   Phase model so we don't have real cover letter rows yet — create
   an empty shadow table so the constraint trivially passes for CV
   exports (where ``cover_letter_id`` is always NULL anyway).

4. Phase 8.5 fix: ``Export.sha256`` column for content-hash audit
   trail. Optional (nullable) — populated by the export route.

5. Phase 9A fix: re-point ``exports.cover_letter_id`` FK from the
   shadow ``cover_letters_tmp`` table to the real ``cover_letters``
   table now that it ships, and drop the shadow table. SQLite doesn't
   support ALTER TABLE ... DROP CONSTRAINT, so we rebuild exports
   via CREATE/INSERT/DROP/RENAME. Safe — the original data is
   preserved.

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
        # Phase 8.5 B10 fix: Export.sha256 column for audit trail.
        ("ALTER TABLE exports ADD COLUMN sha256 VARCHAR(64)",
         "exports.sha256"),
        # B4 fix: clamp any legacy out-of-range score to [0, 1] BEFORE
        # adding CHECK triggers. Otherwise an old row with score=-0.5
        # would crash the next PATCH or auto-rerender with "score out
        # of range". UPDATE first, then add triggers so the constraint
        # doesn't trip on existing rows.
        ("UPDATE cv_drafts SET score = MAX(0.0, MIN(1.0, score)) "
         "WHERE score IS NOT NULL AND (score < 0 OR score > 1)",
         "cv_drafts score clamp"),
        ("UPDATE cv_versions SET score = MAX(0.0, MIN(1.0, score)) "
         "WHERE score IS NOT NULL AND (score < 0 OR score > 1)",
         "cv_versions score clamp"),
        # M7 fix (Phase 9 review): clamp + CHECK trigger for
        # cover_letters.score — same pattern as cv_drafts/cv_versions.
        # Clamp first so any out-of-range legacy rows are fixed before
        # the trigger fires on subsequent writes.
        ("UPDATE cover_letters SET score = MAX(0.0, MIN(1.0, score)) "
         "WHERE score IS NOT NULL AND (score < 0 OR score > 1)",
         "cover_letters score clamp"),
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
        # M7 fix (Phase 9 review): cover_letters.score CHECK triggers.
        ("CREATE TRIGGER IF NOT EXISTS cover_letters_score_check "
         "BEFORE INSERT ON cover_letters "
         "FOR EACH ROW WHEN NEW.score < 0 OR NEW.score > 1 "
         "BEGIN SELECT RAISE(ABORT, 'cover_letters.score out of range'); END;",
         "cover_letters score CHECK trigger"),
        ("CREATE TRIGGER IF NOT EXISTS cover_letters_score_update_check "
         "BEFORE UPDATE ON cover_letters "
         "FOR EACH ROW WHEN NEW.score < 0 OR NEW.score > 1 "
         "BEGIN SELECT RAISE(ABORT, 'cover_letters.score out of range'); END;",
         "cover_letters score UPDATE CHECK trigger"),
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

    # Phase 9A: re-point exports.cover_letter_id FK to cover_letters.
    # Done after the statements above so the column shapes are stable.
    cur.execute("PRAGMA foreign_key_list(exports)")
    fk_targets = {row[2] for row in cur.fetchall()}
    if "cover_letters_tmp" in fk_targets:
        try:
            cur.execute("PRAGMA foreign_keys = OFF")
            cur.execute(
                "CREATE TABLE exports_new ("
                "id VARCHAR(36) PRIMARY KEY,"
                "user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,"
                "entity_type VARCHAR(20) NOT NULL,"
                "entity_id VARCHAR(36),"
                "cv_draft_id VARCHAR(36) REFERENCES cv_drafts(id) ON DELETE SET NULL,"
                "cover_letter_id VARCHAR(36) REFERENCES cover_letters(id) ON DELETE SET NULL,"
                "file_type VARCHAR(10) NOT NULL,"
                "file_path VARCHAR(1000) NOT NULL,"
                "file_size INTEGER NOT NULL,"
                "sha256 VARCHAR(64),"
                "created_at DATETIME"
                ")"
            )
            cur.execute("INSERT INTO exports_new SELECT * FROM exports")
            cur.execute("DROP TABLE exports")
            cur.execute("ALTER TABLE exports_new RENAME TO exports")
            cur.execute("DROP TABLE IF EXISTS cover_letters_tmp")
            cur.execute("PRAGMA foreign_keys = ON")
            cur.execute("PRAGMA foreign_key_check")
            con.commit()
            print("  OK: exports FK re-pointed to cover_letters; cover_letters_tmp dropped")
        except Exception as exc:
            con.rollback()
            print(f"  FAIL: re-point FK failed -> {exc}", file=sys.stderr)
            con.close()
            return 3
    else:
        print("  skip: exports FK already points to cover_letters")

    # Phase 9B: re-point applications.cover_letter_id FK from
    # cover_letters_tmp → cover_letters. Same SQLite shadow-table
    # workaround that bit Phase 8 (exports) and Phase 9A (still in
    # applications because cover_letter_id was added later).
    cur.execute("PRAGMA foreign_key_list(applications)")
    app_fk_targets = {row[2] for row in cur.fetchall()}
    if "cover_letters_tmp" in app_fk_targets:
        try:
            cur.execute("PRAGMA foreign_keys = OFF")
            cur.execute(
                "CREATE TABLE applications_new ("
                "id VARCHAR(36) PRIMARY KEY,"
                "job_id VARCHAR(36) NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,"
                "cv_draft_id VARCHAR(36) REFERENCES cv_drafts(id) ON DELETE SET NULL,"
                "cover_letter_id VARCHAR(36) REFERENCES cover_letters(id) ON DELETE SET NULL,"
                "status VARCHAR(20) NOT NULL,"
                "applied_date DATETIME,"
                "follow_up_date DATETIME,"
                "contact_person VARCHAR(200),"
                "contact_email VARCHAR(200),"
                "notes TEXT,"
                "created_at DATETIME NOT NULL,"
                "updated_at DATETIME NOT NULL"
                ")"
            )
            cur.execute("INSERT INTO applications_new SELECT * FROM applications")
            cur.execute("DROP TABLE applications")
            cur.execute("ALTER TABLE applications_new RENAME TO applications")
            cur.execute("PRAGMA foreign_keys = ON")
            cur.execute("PRAGMA foreign_key_check")
            con.commit()
            print("  OK: applications FK re-pointed to cover_letters")
        except Exception as exc:
            con.rollback()
            print(f"  FAIL: re-point applications FK failed -> {exc}", file=sys.stderr)
            con.close()
            return 5
    else:
        print("  skip: applications FK already points to cover_letters")

    # P10 fix: post-condition smoke test.
    smoke_ok = True
    try:
        cur.execute(
            "INSERT INTO cv_drafts (id, score, cv_json) "
            "VALUES ('__smoke_test__', 2.5, '{}')"
        )
        smoke_ok = False
        cur.execute("DELETE FROM cv_drafts WHERE id = '__smoke_test__'")
    except sqlite3.IntegrityError as e:
        if "out of range" in str(e).lower():
            print("  OK: cv_drafts CHECK trigger fires on bad score")
        else:
            print(f"  FAIL: unexpected IntegrityError -> {e}", file=sys.stderr)
            smoke_ok = False
    except sqlite3.OperationalError as e:
        if "out of range" in str(e).lower():
            print("  OK: cv_drafts CHECK trigger fires on bad score")
        else:
            print(f"  FAIL: unexpected OperationalError -> {e}", file=sys.stderr)
            smoke_ok = False
    except Exception as e:
        print(f"  FAIL: smoke test exception -> {e}", file=sys.stderr)
        smoke_ok = False

    # Verify sha256 column exists.
    cur.execute("PRAGMA table_info(exports)")
    cols = {row[1] for row in cur.fetchall()}
    if "sha256" not in cols:
        print("  FAIL: exports.sha256 column missing", file=sys.stderr)
        smoke_ok = False
    else:
        print("  OK: exports.sha256 column present")

    con.close()
    if not smoke_ok:
        return 4
    print("migration complete")
    return 0


if __name__ == "__main__":
    sys.exit(main())