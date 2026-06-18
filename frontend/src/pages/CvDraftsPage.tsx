import { FileText } from 'lucide-react';
import PlaceholderPage from './PlaceholderPage';
export default function CvDraftsPage() {
  return (
    <PlaceholderPage
      title="CV Drafts"
      description="All your generated CVs. Preview, edit, score, and export to PDF or DOCX."
      icon={FileText}
      phase="Phase 6 — CV generator + Phase 10 — Export"
    />
  );
}
