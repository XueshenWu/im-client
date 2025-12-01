import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const applyTheme = (theme: Theme) => {
  if (typeof window === 'undefined') return;

  const root = window.document.documentElement;
  root.classList.remove('light', 'dark');

  if (theme === 'system') {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
    root.classList.add(systemTheme);
    console.log(`[Theme] Applied system theme: ${systemTheme}, HTML classes:`, root.className);
  } else {
    root.classList.add(theme);
    console.log(`[Theme] Applied theme: ${theme}, HTML classes:`, root.className);
  }
};

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme: Theme) => {
        applyTheme(theme);
        set({ theme });
      },
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        // Apply theme after hydration
        if (state?.theme) {
          applyTheme(state.theme);
        } else {
          // Apply default theme
          applyTheme('system');
        }
      },
    }
  )
);

// Initialize theme immediately on module load
if (typeof window !== 'undefined') {
  const storedTheme = localStorage.getItem('theme-storage');
  const initialTheme: Theme = storedTheme
    ? (JSON.parse(storedTheme).state?.theme || 'system')
    : 'system';
  applyTheme(initialTheme);

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const { theme } = useThemeStore.getState();
    if (theme === 'system') {
      applyTheme('system');
    }
  });
}
