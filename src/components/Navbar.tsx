import { ThemeToggle } from './ThemeToggle';

export type AppPage = 'home' | 'report';

interface NavbarProps {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  hasReports: boolean;
}

export function Navbar({
  currentPage,
  onNavigate,
  theme,
  onToggleTheme,
  hasReports,
}: NavbarProps) {
  return (
    <div className="border-b border-slate-200 bg-white/95 backdrop-blur-sm transition-colors duration-300 dark:border-slate-800 dark:bg-slate-950/95">
      {/* Three-Zone Top Bar Contract */}
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:gap-8 sm:px-6 sm:py-4">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('home');
          }}
          className="font-display text-base font-bold tracking-tight text-slate-900 sm:text-lg dark:text-white whitespace-nowrap shrink-0"
        >
          CloudOptix
        </a>

        <nav
          aria-label="Primary navigation"
          className="flex items-center gap-4 text-sm font-medium text-slate-600 sm:gap-6 dark:text-slate-300"
        >
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('home');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 hover:text-blue-600 dark:hover:text-blue-400 ${
              currentPage === 'home'
                ? 'text-blue-600 underline decoration-2 underline-offset-8 dark:text-blue-400'
                : ''
            }`}
          >
            Home
          </a>
          <a
            href="#upload-section"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('home');
              setTimeout(() => {
                document.getElementById('upload-section')?.scrollIntoView({ behavior: 'smooth' });
              }, 50);
            }}
            className="hidden sm:inline-block transition-colors whitespace-nowrap shrink-0 hover:text-blue-600 dark:hover:text-blue-400"
          >
            Upload CSV
          </a>
          <a
            href="#history-section"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('home');
              setTimeout(() => {
                document.getElementById('history-section')?.scrollIntoView({ behavior: 'smooth' });
              }, 50);
            }}
            className="hidden sm:inline-block transition-colors whitespace-nowrap shrink-0 hover:text-blue-600 dark:hover:text-blue-400"
          >
            History
          </a>
          <a
            href="/report"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('report');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 hover:text-blue-600 dark:hover:text-blue-400 ${
              currentPage === 'report'
                ? 'text-blue-600 underline decoration-2 underline-offset-8 dark:text-blue-400'
                : ''
            }`}
          >
            Report
          </a>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => onNavigate(currentPage === 'home' ? 'report' : 'home')}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {currentPage === 'home'
              ? hasReports
                ? 'View Report'
                : 'Open Report'
              : 'Upload CSV'}
          </button>
        </div>
      </header>

      {/* Workspace Appearance Toolbar */}
      <div className="border-t border-slate-100 bg-slate-50/70 dark:border-slate-800/80 dark:bg-slate-900/50">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-2.5">
          <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
            {currentPage === 'home'
              ? 'Workspace / Ingestion & Historical Records'
              : 'Workspace / Optimization Report & Telemetry Analytics'}
          </p>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>
    </div>
  );
}
