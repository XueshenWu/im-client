import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AppSettings, SourceMode, SyncPolicy } from '@/types/local';

interface SettingsStore extends AppSettings {
  setSourceMode: (mode: SourceMode) => void;
  setSyncPolicy: (policy: Partial<SyncPolicy>) => void;
  setExportOnConflict: (value: boolean) => void;
  resetSettings: () => void;
}

const defaultSettings: AppSettings = {
  sourceMode: 'cloud',
  syncPolicy: {
    mode: 'manual',
    intervalSeconds: 60,
  },
  exportOnConflict: true,
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaultSettings,
      setSourceMode: (mode: SourceMode) => {
        console.log('[Settings] Source mode changed to:', mode);
        set({ sourceMode: mode });
      },
      setSyncPolicy: (policy: Partial<SyncPolicy>) =>
        set((state) => ({
          syncPolicy: { ...state.syncPolicy, ...policy },
        })),
      setExportOnConflict: (value: boolean) =>
        set({ exportOnConflict: value }),
      resetSettings: () => set(defaultSettings),
    }),
    {
      name: 'app-settings-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
