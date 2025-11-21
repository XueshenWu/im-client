import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import i18n from '@/i18n/config';

interface LanguageStore {
  language: string;
  changeLanguage: (lng: string) => void;
}

export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set) => ({
      language: 'en',
      changeLanguage: async (lng: string) => {
        await i18n.changeLanguage(lng);
        set({ language: lng });
      },
    }),
    {
      name: 'language-storage',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => async (state) => {
        // Initialize i18n with stored language after hydration
        if (state?.language) {
          await i18n.changeLanguage(state.language);
        }
      },
    }
  )
);
