import { User } from 'lucide-react';
import PlaceholderPage from './PlaceholderPage';
export default function ProfilePage() {
  return (
    <PlaceholderPage
      title="Profile / Base Profile"
      description="Upload your primary resume. AI extracts and builds a Base Profile that powers every tailored CV."
      icon={User}
      phase="Phase 2 — Resume upload + AI parser"
    />
  );
}
