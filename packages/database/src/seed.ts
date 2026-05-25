// @lolos/database — Seed script: 3 default ATS-safe templates
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding default templates...');

  const templates = [
    {
      name: 'Professional',
      category: 'corporate',
      locale: 'id',
      isPremium: false,
      config: {
        layout: 'single-column',
        fonts: { heading: 'Arial', body: 'Calibri' },
        colors: {
          primary: '#1a1a2e',
          secondary: '#16213e',
          accent: '#0f3460',
          text: '#333333',
          background: '#ffffff',
          heading: '#1a1a2e',
        },
        spacing: { sectionGap: 24, entryGap: 16, paddingX: 48, paddingY: 48 },
        sectionOrder: [
          'header',
          'summary',
          'experience',
          'education',
          'skills',
          'certifications',
          'languages',
        ],
      },
    },
    {
      name: 'Modern',
      category: 'tech',
      locale: 'id',
      isPremium: false,
      config: {
        layout: 'single-column',
        fonts: { heading: 'Inter', body: 'Inter' },
        colors: {
          primary: '#6366f1',
          secondary: '#4f46e5',
          accent: '#8b5cf6',
          text: '#18181b',
          background: '#ffffff',
          heading: '#6366f1',
        },
        spacing: { sectionGap: 28, entryGap: 20, paddingX: 44, paddingY: 44 },
        sectionOrder: [
          'header',
          'skills',
          'experience',
          'education',
          'projects',
          'certifications',
        ],
      },
    },
    {
      name: 'Minimal',
      category: 'fresh-graduate',
      locale: 'id',
      isPremium: false,
      config: {
        layout: 'single-column',
        fonts: { heading: 'Inter', body: 'Inter' },
        colors: {
          primary: '#374151',
          secondary: '#4b5563',
          accent: '#6366f1',
          text: '#1f2937',
          background: '#ffffff',
          heading: '#111827',
        },
        spacing: { sectionGap: 20, entryGap: 14, paddingX: 40, paddingY: 40 },
        sectionOrder: [
          'header',
          'education',
          'achievements',
          'experience',
          'projects',
          'skills',
          'languages',
        ],
      },
    },
  ];

  for (const template of templates) {
    await prisma.template.create({ data: template });
  }

  console.log(`Seeded ${templates.length} default templates.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
