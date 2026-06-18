import { Briefcase } from 'lucide-react';
import PlaceholderPage from './PlaceholderPage';
export default function JobsPage() {
  return (
    <PlaceholderPage
      title="Job Matching"
      description="Paste a job URL or description. AI analyzes it and creates a tailored CV + cover letter for that role."
      icon={Briefcase}
      phase="Phase 4 — Job analyzer + Phase 5 — Matching engine"
    />
  );
}
