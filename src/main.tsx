import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import './index.css';
import App from './App.tsx';
import { withPasswordAuth } from './components/withPasswordAuth';

const AuthedApp = withPasswordAuth(App);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AuthedApp />
      <Toaster position="top-right" />
    </HashRouter>
  </StrictMode>,
);
