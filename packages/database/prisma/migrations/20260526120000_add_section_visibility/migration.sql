-- Story 2.2 review fix: persist section visibility (AC-5)
ALTER TABLE "resume_sections" ADD COLUMN "visible" BOOLEAN NOT NULL DEFAULT true;
