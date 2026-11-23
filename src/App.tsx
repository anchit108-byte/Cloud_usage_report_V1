import { useCallback, useEffect, useState } from 'react';
import { Navbar, type AppPage } from './components/Navbar';
import { HomePage } from './pages/HomePage';
import { ReportPage } from './pages/ReportPage';
import type { OptimizationReport, UploadHistoryItem } from './types/cloud';

function getInitialTheme(): 'light' | 'dark' {
  try {
    const saved = localStorage.getItem('cloudoptix_theme');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // ignore storage errors
  }
  return 'light';
}

function getInitialPage(): AppPage {
  return window.location.pathname === '/report' ? 'report' : 'home';
}

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);
  const [currentPage, setCurrentPage] = useState<AppPage>(getInitialPage);
  const [history, setHistory] = useState<UploadHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [activeReport, setActiveReport] = useState<OptimizationReport | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('cloudoptix_theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  useEffect(() => {
    const onPopState = () => {
      setCurrentPage(window.location.pathname === '/report' ? 'report' : 'home');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const loadPersistedData = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const [histRes, latestRes] = await Promise.all([
        fetch('/api/history'),
        fetch('/api/reports/latest'),
      ]);
      if (histRes.ok) {
        const histJson = await histRes.json();
        setHistory(histJson.items ?? []);
      }
      if (latestRes.ok) {
        const latestJson = await latestRes.json();
        setActiveReport(latestJson.report ?? null);
      }
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    void loadPersistedData();
  }, [loadPersistedData]);

  const navigate = (page: AppPage) => {
    setCurrentPage(page);
    const targetPath = page === 'report' ? '/report' : '/';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUploadComplete = (report: OptimizationReport) => {
    setActiveReport(report);
    void loadPersistedData();
  };

  const handleOpenReport = async (reportId: string) => {
    try {
      const res = await fetch(`/api/reports/${encodeURIComponent(reportId)}`);
      if (res.ok) {
        const json = await res.json();
        setActiveReport(json.report ?? null);
      }
    } catch {
      // keep existing report if fetch fails
    }
    navigate('report');
  };

  const handleDeleteUpload = async (uploadId: string) => {
    const res = await fetch(`/api/uploads/${encodeURIComponent(uploadId)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      await loadPersistedData();
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
      <Navbar
        currentPage={currentPage}
        onNavigate={navigate}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
        hasReports={history.length > 0}
      />

      {currentPage === 'home' ? (
        <HomePage
          history={history}
          isLoadingHistory={isLoadingHistory}
          onUploadComplete={handleUploadComplete}
          onOpenReport={(id) => void handleOpenReport(id)}
          onDeleteUpload={handleDeleteUpload}
          onNavigateToReportPage={() => navigate('report')}
        />
      ) : (
        <ReportPage
          report={activeReport}
          history={history}
          onSelectReport={(id) => void handleOpenReport(id)}
          onNavigateHome={() => navigate('home')}
        />
      )}

      <footer className="mt-16 border-t border-slate-200 bg-slate-50/60 py-6 dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 text-xs text-slate-500 dark:text-slate-400">
          <span>AI-Based Cloud Usage and Cloud Cost Optimization System</span>
          <span>SQLite Persistent Storage · Dynamic Analytics</span>
        </div>
      </footer>
    </div>
  );
}
