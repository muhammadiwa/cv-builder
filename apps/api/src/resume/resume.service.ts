import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { prisma } from '@lolos/database';

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

  async update(userId: string, resumeId: string, data: { title?: string; status?: 'draft' | 'published' | 'archived' }) {
    const r = await prisma.resume.findFirst({ where: { id: resumeId, userId } });
    if (!r) throw new NotFoundException();
    return prisma.resume.update({ where: { id: resumeId }, data });
  }

  async duplicate(userId: string, resumeId: string): Promise<any> {
    const original = await this.get(userId, resumeId);
    return prisma.$transaction(async (tx) => {
      const copy = await tx.resume.create({
        data: { userId, templateId: original.templateId, title: `${original.title} (Copy)`, language: original.language },
      });
      for (const s of original.sections) {
        await tx.resumeSection.create({
          data: { resumeId: copy.id, sectionType: s.sectionType, displayOrder: s.displayOrder, content: s.content as any },
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
