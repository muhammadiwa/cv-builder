import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma, prisma } from '@lolos/database';
import type { UpdateResumeInput, SectionInput } from '@lolos/validators';
import { mergeContentLWW, type ServerConflict } from './field-lww';

@Injectable()
export class ResumeService {
  async create(userId: string, data: { title: string; language?: string }) {
    const count = await prisma.resume.count({ where: { userId, status: { not: 'archived' } } });
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { subscription: true } });
    if (!user?.subscription || user.subscription.planTier === 'free') {
      if (count >= 1) throw new ForbiddenException('Free tier limited to 1 resume');
    }

    const template = await prisma.template.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
    if (!template) throw new NotFoundException('No active template');

    return prisma.resume.create({
      data: { userId, templateId: template.id, title: data.title, language: data.language || 'id' },
    });
  }

  async list(userId: string) {
    return prisma.resume.findMany({
      where: { userId },
      include: { template: { select: { id: true, name: true, thumbnailUrl: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async get(userId: string, resumeId: string): Promise<any> {
    const r = await prisma.resume.findFirst({
      where: { id: resumeId, userId },
      include: { template: true, sections: { orderBy: { displayOrder: 'asc' } } },
    });
    if (!r) throw new NotFoundException();
    return r;
  }

  async update(userId: string, resumeId: string, data: UpdateResumeInput) {
    const r = await prisma.resume.findFirst({ where: { id: resumeId, userId } });
    if (!r) throw new NotFoundException();

    return prisma.$transaction(async (tx) => {
      let conflicts: ServerConflict[] = [];
      if (data.sections !== undefined) {
        conflicts = await this.syncSections(tx, resumeId, data.sections);
      }

      const { sections: _ignored, ...resumeData } = data;
      if (Object.keys(resumeData).length > 0) {
        await tx.resume.update({ where: { id: resumeId }, data: resumeData });
      }

      const resume = await tx.resume.findFirst({
        where: { id: resumeId, userId },
        include: { sections: { orderBy: { displayOrder: 'asc' } } },
      });
      // Surface conflicts alongside the updated resume so the client UI can
      // toast each discarded field. `conflicts` is omitted when empty so the
      // happy path stays clean.
      return conflicts.length > 0 ? { ...resume, conflicts } : resume;
    });
  }

  /**
   * Reconcile resume_sections rows against the client payload inside an open
   * Prisma transaction. Performs ownership scoping (rejecting cross-resume IDs
   * to prevent IDOR), bounded delete-of-removed (no `notIn: []` blast radius),
   * update-in-place for known IDs, and create-for-new.
   *
   * Per-field LWW: for each updated section, the existing stored content is
   * merged with the incoming content using `mergeContentLWW` so concurrent
   * edits from another device don't silently overwrite. Discarded client
   * fields are returned as conflicts.
   */
  private async syncSections(
    tx: Prisma.TransactionClient,
    resumeId: string,
    sections: SectionInput[],
  ): Promise<ServerConflict[]> {
    // Inputs with an `id` are claimed-existing. Verify each claimed ID actually
    // belongs to this resume before we touch it.
    const claimedIds = sections.filter((s): s is SectionInput & { id: string } => Boolean(s.id)).map((s) => s.id);
    let storedById = new Map<string, { id: string; content: Prisma.JsonValue; sectionType: string }>();
    if (claimedIds.length > 0) {
      const owned = await tx.resumeSection.findMany({
        where: { resumeId, id: { in: claimedIds } },
        select: { id: true, content: true, sectionType: true },
      });
      const ownedIdSet = new Set(owned.map((s) => s.id));
      const foreign = claimedIds.filter((id) => !ownedIdSet.has(id));
      if (foreign.length > 0) {
        throw new ForbiddenException(
          `Section id(s) do not belong to resume ${resumeId}: ${foreign.join(', ')}`,
        );
      }
      storedById = new Map(owned.map((s) => [s.id, s]));
    }

    // Delete any section currently on the resume that wasn't included in the
    // payload (treat the array as the new authoritative state).
    await tx.resumeSection.deleteMany({
      where: {
        resumeId,
        ...(claimedIds.length > 0 ? { id: { notIn: claimedIds } } : {}),
      },
    });

    const serverNow = Date.now();
    const allConflicts: ServerConflict[] = [];

    for (const s of sections) {
      const incomingContent = s.content as Record<string, unknown>;
      let mergedContent: Record<string, unknown> = incomingContent;

      if (s.id) {
        const stored = storedById.get(s.id);
        if (stored) {
          const storedContent = (stored.content as Record<string, unknown>) ?? {};
          const result = mergeContentLWW(
            incomingContent,
            storedContent,
            serverNow,
            s.id,
            stored.sectionType,
          );
          mergedContent = result.merged;
          allConflicts.push(...result.conflicts);
        }
      } else {
        // Brand-new section: stamp every top-level field with serverNow so
        // future syncs from any device have a baseline to compare against.
        mergedContent = stampNewSectionFields(incomingContent, serverNow);
      }

      const payload = {
        sectionType: s.sectionType,
        displayOrder: s.displayOrder,
        content: mergedContent as object,
        visible: s.visible ?? true,
      };

      if (s.id) {
        // Scope-by-resume update guards against IDOR even if the ownership
        // check above somehow lets a stale id slip through.
        await tx.resumeSection.updateMany({
          where: { id: s.id, resumeId },
          data: payload,
        });
      } else {
        await tx.resumeSection.create({
          data: { resumeId, ...payload },
        });
      }
    }

    return allConflicts;
  }

  async duplicate(userId: string, resumeId: string): Promise<any> {
    const original = await this.get(userId, resumeId);
    return prisma.$transaction(async (tx) => {
      const copy = await tx.resume.create({
        data: { userId, templateId: original.templateId, title: `${original.title} (Copy)`, language: original.language },
      });
      for (const s of original.sections) {
        await tx.resumeSection.create({
          data: {
            resumeId: copy.id,
            sectionType: s.sectionType,
            displayOrder: s.displayOrder,
            content: s.content as any,
            visible: s.visible,
          },
        });
      }
      return copy;
    });
  }

  async archive(userId: string, resumeId: string) {
    return this.update(userId, resumeId, { status: 'archived' });
  }

  async delete(userId: string, resumeId: string) {
    const r = await prisma.resume.findFirst({ where: { id: resumeId, userId } });
    if (!r) throw new NotFoundException();
    await prisma.resume.delete({ where: { id: resumeId } });
    return { message: 'Deleted' };
  }
}

/**
 * Stamp every top-level field in a brand-new section's content with
 * `serverNow` so future LWW rounds have a baseline to compare against. Skips
 * the metadata key itself.
 */
function stampNewSectionFields(
  content: Record<string, unknown> | null | undefined,
  serverNow: number,
): Record<string, unknown> {
  const safe = content && typeof content === 'object' ? content : {};
  const out: Record<string, unknown> = { ...safe };
  const ts: Record<string, number> = {};
  for (const key of Object.keys(safe)) {
    if (key === '__field_updated_at') continue;
    ts[key] = serverNow;
  }
  if (Object.keys(ts).length > 0) {
    out['__field_updated_at'] = ts;
  }
  return out;
}
