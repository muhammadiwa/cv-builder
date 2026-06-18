import { Navigate, createBrowserRouter } from 'react-router-dom';
import App from '../App';
import DashboardPage from '../pages/DashboardPage';
import ProfilePage from '../pages/ProfilePage';
import JobsPage from '../pages/JobsPage';
import CvDraftsPage from '../pages/CvDraftsPage';
import CoverLettersPage from '../pages/CoverLettersPage';
import ApplicationsPage from '../pages/ApplicationsPage';
import TemplatesPage from '../pages/TemplatesPage';
import PromptsPage from '../pages/PromptsPage';
import SettingsPage from '../pages/SettingsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'jobs', element: <JobsPage /> },
      { path: 'cv-drafts', element: <CvDraftsPage /> },
      { path: 'cover-letters', element: <CoverLettersPage /> },
      { path: 'applications', element: <ApplicationsPage /> },
      { path: 'templates', element: <TemplatesPage /> },
      { path: 'prompts', element: <PromptsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
