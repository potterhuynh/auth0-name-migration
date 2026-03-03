import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UploadSection } from './components/UploadSection';
import { JobsManagement } from './components/JobsManagement';
import { RecordsManagement } from './components/RecordsManagement';
import { Button } from './components/ui/button';

type Page = 'upload' | 'jobs' | 'records' | 'settings';

function pageFromPath(pathname: string): Page {
  if (pathname.startsWith('/jobs')) return 'jobs';
  if (pathname.startsWith('/records')) return 'records';
  if (pathname.startsWith('/settings')) return 'settings';
  return 'upload';
}

function pathFromPage(page: Page): string {
  switch (page) {
    case 'jobs':
      return '/jobs';
    case 'records':
      return '/records';
    case 'settings':
      return '/settings';
    case 'upload':
    default:
      return '/upload';
  }
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname === '/') {
      navigate('/upload', { replace: true });
    }
  }, [location.pathname, navigate]);

  const page = pageFromPath(location.pathname);

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
      <div className="flex min-w-0 flex-1 gap-4 overflow-hidden px-4 py-4">
        {/* Sidebar */}
        <aside className="hidden w-56 flex-shrink-0 flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex">
          <div className="mb-6">
            <h1 className="text-lg font-semibold tracking-tight">
              Auth0 Migration
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Monitor and run name migration jobs.
            </p>
          </div>

          <nav className="space-y-1 text-sm">
            <Button
              variant={page === 'upload' ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => navigate(pathFromPage('upload'))}
            >
              Upload
            </Button>
            <Button
              variant={page === 'jobs' ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => navigate(pathFromPage('jobs'))}
            >
              Jobs management
            </Button>
            <Button
              variant={page === 'records' ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => navigate(pathFromPage('records'))}
            >
              Records management
            </Button>
            <Button
              variant={page === 'settings' ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => navigate(pathFromPage('settings'))}
            >
              Settings
            </Button>
          </nav>

          <div className="mt-auto pt-4 text-xs text-slate-400">
            shadcn-style UI powered by Tailwind.
          </div>
        </aside>

        {/* Main content */}
        <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
          <header className="md:hidden">
            <h1 className="text-xl font-semibold tracking-tight">
              Auth0 Name Migration Dashboard
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Upload JSON files, create jobs, and monitor Supabase history.
            </p>
          </header>

          {page === 'upload' && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold">Upload file</h2>
              <p className="mt-1 text-xs text-slate-500">
                Upload a JSON file containing an array of Auth0 user records for migration.
              </p>
              <UploadSection />
            </section>
          )}

          {page === 'jobs' && (
            <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <JobsManagement />
            </section>
          )}

          {page === 'records' && (
            <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <RecordsManagement />
            </section>
          )}

          {page === 'settings' && (
            <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold">Settings</h2>
              <p className="text-sm text-slate-600">
                Environment variables are loaded from your Vite config. For local
                development, ensure:
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
                <li>
                  <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
                    VITE_API_BASE_URL
                  </code>{' '}
                  points to your local lambda URL.
                </li>
                <li>
                  <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
                    VITE_SUPABASE_URL
                  </code>{' '}
                  and{' '}
                  <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
                    VITE_SUPABASE_ANON_KEY
                  </code>{' '}
                  match your Supabase project.
                </li>
              </ul>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
