import React from 'react';
import { useThemeStore, type Theme } from '@/stores/themeStore';
import { Monitor, Sun, Moon } from 'lucide-react';

const ThemeSwitcher: React.FC = () => {
  const { theme, setTheme } = useThemeStore();

  const themes: { value: Theme; label: string; icon: React.ReactNode }[] = [
    {
      value: 'system',
      label: 'System (default)',
      icon: <Monitor className="w-8 h-8" />,
    },
    {
      value: 'light',
      label: 'Light',
      icon: <Sun className="w-8 h-8" />,
    },
    {
      value: 'dark',
      label: 'Dark',
      icon: <Moon className="w-8 h-8" />,
    },
  ];

  return (
    <div className="flex gap-4">
      {themes.map((themeOption) => (
        <button
          key={themeOption.value}
          onClick={() => setTheme(themeOption.value)}
          className={`
            relative cursor-pointer flex flex-col items-center gap-3 p-4 rounded-lg border-2 transition-all
            ${
              theme === themeOption.value
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }
          `}
        >
          {/* Theme preview card */}
          <div
            className={`
              w-24 h-16 rounded-md overflow-hidden border border-gray-300 dark:border-gray-600
              ${themeOption.value === 'light' ? 'bg-white' : ''}
              ${themeOption.value === 'dark' ? 'bg-gray-900' : ''}
              ${themeOption.value === 'system' ? 'bg-gradient-to-r from-white to-gray-900' : ''}
            `}
          >
            {themeOption.value === 'system' ? (
              <div className="flex h-full">
                <div className="flex-1 bg-white" />
                <div className="flex-1 bg-gray-900" />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div
                  className={`
                    ${themeOption.value === 'light' ? 'text-gray-400' : 'text-gray-500'}
                  `}
                >
                  {themeOption.icon}
                </div>
              </div>
            )}
          </div>

          {/* Label */}
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {themeOption.label}
          </span>

          {/* Selected indicator */}
          {theme === themeOption.value && (
            <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
};

export default ThemeSwitcher;
