import { Moon, Sun } from 'lucide-react';

interface ThemeToggleProps {
  theme: 'light' | 'dark';
  onToggle: () => void;
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-pressed={isDark}
      className="group relative inline-flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-all duration-200 hover:border-blue-300 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:text-blue-300 whitespace-nowrap shrink-0 cursor-pointer"
    >
      <span className="relative flex h-5 w-9 items-center rounded-full bg-slate-200 p-0.5 transition-colors duration-300 dark:bg-blue-600">
        <span
          className={`flex h-4 w-4 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] dark:text-blue-700 ${
            isDark ? 'translate-x-4' : 'translate-x-0'
          }`}
        >
          {isDark ? <Moon className="h-2.5 w-2.5" /> : <Sun className="h-2.5 w-2.5 text-amber-500" />}
        </span>
      </span>
      <span>{isDark ? 'Dark Mode' : 'Light Mode'}</span>
    </button>
  );
}
