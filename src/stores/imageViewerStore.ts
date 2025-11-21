import { create } from 'zustand';
import type { Image } from '@/types/api';

interface ImageViewerStore {
  isOpen: boolean;
  currentImage: Image | null;
  images: Image[];
  currentIndex: number;
  openViewer: (image: Image, allImages?: Image[]) => void;
  closeViewer: () => void;
  nextImage: () => void;
  previousImage: () => void;
  setCurrentIndex: (index: number) => void;
}

export const useImageViewerStore = create<ImageViewerStore>((set, get) => ({
  isOpen: false,
  currentImage: null,
  images: [],
  currentIndex: 0,

  openViewer: (image: Image, allImages?: Image[]) => {
    const images = allImages || [image];
    const currentIndex = allImages
      ? images.findIndex(img => img.uuid === image.uuid)
      : 0;

    set({
      isOpen: true,
      currentImage: image,
      images,
      currentIndex: currentIndex >= 0 ? currentIndex : 0,
    });
  },

  closeViewer: () => {
    set({
      isOpen: false,
      currentImage: null,
      images: [],
      currentIndex: 0,
    });
  },

  nextImage: () => {
    const { images, currentIndex } = get();
    if (images.length === 0) return;

    const nextIndex = (currentIndex + 1) % images.length;
    set({
      currentIndex: nextIndex,
      currentImage: images[nextIndex],
    });
  },

  previousImage: () => {
    const { images, currentIndex } = get();
    if (images.length === 0) return;

    const prevIndex = currentIndex === 0 ? images.length - 1 : currentIndex - 1;
    set({
      currentIndex: prevIndex,
      currentImage: images[prevIndex],
    });
  },

  setCurrentIndex: (index: number) => {
    const { images } = get();
    if (index >= 0 && index < images.length) {
      set({
        currentIndex: index,
        currentImage: images[index],
      });
    }
  },
}));