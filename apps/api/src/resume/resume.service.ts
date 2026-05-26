import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma, prisma } from '@lolos/database';
import type { UpdateResumeInput, SectionInput } from '@lolos/validators';

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
      if (data.sections !== undefined) {
        await this.syncSections(tx, resumeId, data.sections);
      }

      const { sections: _ignored, ...resumeData } = data;
      if (Object.keys(resumeData).length > 0) {
        await tx.resume.update({ where: { id: resumeId }, data: resumeData });
      }

      return tx.resume.findFirst({
        where: { id: resumeId, userId },
        include: { sections: { orderBy: { displayOrder: 'asc' } } },
      });
    });
  }

  /**
   * Reconcile resume_sections rows against the client payload inside an open
   * Prisma transaction. Performs ownership scoping (rejecting cross-resume IDs
   * to prevent IDOR), bounded delete-of-removed (no `notIn: []` blast radius),
   * update-in-place for known IDs, and create-for-new.
   */
  private async syncSections(
    tx: Prisma.TransactionClient,
    resumeId: string,
    sections: SectionInput[],
  ) {
    // Inputs with an `id` are claimed-existing. Verify each claimed ID actually
    // belongs to this resume before we touch it.
    const claimedIds = sections.filter((s): s is SectionInput & { id: string } => Boolean(s.id)).map((s) => s.id);
    if (claimedIds.length > 0) {
      const owned = await tx.resumeSection.findMany({
        where: { resumeId, id: { in: claimedIds } },
        select: { id: true },
      });
      const ownedIdSet = new Set(owned.map((s) => s.id));
      const foreign = claimedIds.filter((id) => !ownedIdSet.has(id));
      if (foreign.length > 0) {
        throw new ForbiddenException(
          `Section id(s) do not belong to resume ${resumeId}: ${foreign.join(', ')}`,
        );
      }
    }

    // Delete any section currently on the resume that wasn't included in the
    // payload (treat the array as the new authoritative state).
    await tx.resumeSection.deleteMany({
      where: {
        resumeId,
        ...(claimedIds.length > 0 ? { id: { notIn: claimedIds } } : {}),
      },
    });

    for (const s of sections) {
      const payload = {
        sectionType: s.sectionType,
        displayOrder: s.displayOrder,
        content: s.content as object,
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
