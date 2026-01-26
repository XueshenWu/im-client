import { create } from 'zustand';
import type { ImageWithSource } from '@/types/gallery';

interface ImageViewerFilerobotStore {
  isOpen: boolean;
  currentImage: ImageWithSource | null;
  isLocalImage: boolean;

  openEditor: (image: ImageWithSource) => void;
  closeEditor: () => void;
}

export const useImageViewerFilerobotStore = create<ImageViewerFilerobotStore>((set) => ({
  isOpen: false,
  currentImage: null,
  isLocalImage: false,

  openEditor: (image: ImageWithSource) => {
    const isLocal = (image as any).source === 'local';
    set({
      isOpen: true,
      currentImage: image,
      isLocalImage: isLocal,
    });
  },

  closeEditor: () => {
    set({
      isOpen: false,
      currentImage: null,
      isLocalImage: false,
    });
  },
}));
