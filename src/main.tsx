import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import './index.css';
import App from './App.tsx';
import { withPasswordAuth } from './components/withPasswordAuth';
import { SupabaseClientProvider } from './components/SupabaseClientContext';

const AuthedApp = withPasswordAuth(App);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SupabaseClientProvider>
      <HashRouter>
        <AuthedApp />
        <Toaster position="top-right" />
      </HashRouter>
    </SupabaseClientProvider>
  </StrictMode>,
);
