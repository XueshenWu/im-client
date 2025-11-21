import { create } from 'zustand';

interface GalleryRefreshStore {
  refreshTrigger: number;
  triggerRefresh: () => void;
}

export const useGalleryRefreshStore = create<GalleryRefreshStore>((set) => ({
  refreshTrigger: 0,
  triggerRefresh: () => set((state) => ({ refreshTrigger: state.refreshTrigger + 1 })),
}));
