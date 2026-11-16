import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './styles.css';
import { AppProvider } from './store';
import { Shell } from './components/Shell';
import { Today } from './pages/Today';
import { Boite } from './pages/Boite';
import { Bilan } from './pages/Bilan';
import { Moi } from './pages/Moi';
import { Tendances } from './pages/Tendances';
import { Reglages } from './pages/Reglages';
import { Donnees } from './pages/Donnees';
import { Onboarding } from './pages/Onboarding';

const router = createBrowserRouter([
  {
    element: <Shell />,
    children: [
      { path: '/', element: <Today /> },
      { path: '/partage', element: <Today /> },
      { path: '/boite', element: <Boite /> },
      { path: '/panier', element: <Boite /> },
      { path: '/pensees', element: <Boite /> },
      { path: '/bilan', element: <Bilan /> },
      { path: '/moi', element: <Moi /> },
      { path: '/moi/tendances', element: <Tendances /> },
      { path: '/moi/reglages', element: <Reglages /> },
      { path: '/moi/donnees', element: <Donnees /> },
      { path: '/bienvenue', element: <Onboarding /> },
      { path: '*', element: <Today /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <RouterProvider router={router} />
    </AppProvider>
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
