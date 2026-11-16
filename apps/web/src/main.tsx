import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/source-serif-4';
import './styles.css';
import { api } from './api';
import { navigate, useLocation } from './router';
import { Spinner } from './components/ui';
import Setup from './pages/Setup';
import Login from './pages/Login';
import { HelpForm, HelpStatus } from './pages/Help';
import Console from './pages/Console';

function App() {
  const { path } = useLocation();
  const [status, setStatus] = useState<{ configured: boolean } | null>(null);

  useEffect(() => {
    api('/api/status').then(setStatus).catch(() => setStatus({ configured: true }));
  }, [path === '/setup']);

  if (!status) return <div className="center-screen"><Spinner /></div>;
  if (!status.configured && path !== '/setup') {
    navigate(`/setup${location.search}`, true);
    return null;
  }
  if (path === '/setup') return <Setup />;
  if (path === '/login') return <Login />;
  if (path === '/help') return <HelpForm />;
  if (path.startsWith('/help/status/')) return <HelpStatus refId={path.split('/')[3] ?? ''} />;
  if (path.startsWith('/app')) return <Console path={path} />;
  navigate('/app', true);
  return null;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
