import { RouterProvider } from 'react-router-dom';
import { router } from './lib/router';

export default function Root() {
  return <RouterProvider router={router} />;
}
