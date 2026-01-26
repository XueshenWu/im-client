import { create } from 'zustand';
import type { ImageWithSource } from '@/types/gallery';

interface ImageViewerStoreV2 {
  // Core state
  isOpen: boolean;
  currentImage: ImageWithSource | null;
  images: ImageWithSource[];
  currentIndex: number;
  readOnly: boolean;

  // Tool system - generic instead of hardcoded modes
  activeToolId: string | null;
  toolState: Record<string, any>;

  // Actions - viewer control
  openViewer: (image: ImageWithSource, allImages?: ImageWithSource[], readOnly?: boolean) => void;
  closeViewer: () => void;
  nextImage: () => void;
  previousImage: () => void;
  setCurrentIndex: (index: number) => void;

  // Actions - tool system
  setActiveTool: (toolId: string | null) => void;
  setToolState: (toolId: string, state: any) => void;
  getToolState: <T>(toolId: string) => T | undefined;
  clearToolState: (toolId: string) => void;
}

export const useImageViewerStoreV2 = create<ImageViewerStoreV2>((set, get) => ({
  // Initial state
  isOpen: false,
  currentImage: null,
  images: [],
  currentIndex: 0,
  readOnly: false,
  activeToolId: null,
  toolState: {},

  openViewer: (image: ImageWithSource, allImages?: ImageWithSource[], readOnly = false) => {
    const images = allImages || [image];
    const currentIndex = allImages
      ? images.findIndex(img => img.uuid === image.uuid)
      : 0;

    set({
      isOpen: true,
      currentImage: image,
      images,
      currentIndex: currentIndex >= 0 ? currentIndex : 0,
      readOnly,
      activeToolId: null,
      toolState: {},
    });
  },

  closeViewer: () => {
    set({
      isOpen: false,
      currentImage: null,
      images: [],
      currentIndex: 0,
      activeToolId: null,
      toolState: {},
    });
  },

  nextImage: () => {
    const { images, currentIndex, activeToolId } = get();
    // Don't allow navigation while a tool is active
    if (activeToolId || images.length === 0) return;

    const nextIndex = (currentIndex + 1) % images.length;
    set({
      currentIndex: nextIndex,
      currentImage: images[nextIndex],
    });
  },

  previousImage: () => {
    const { images, currentIndex, activeToolId } = get();
    // Don't allow navigation while a tool is active
    if (activeToolId || images.length === 0) return;

    const prevIndex = currentIndex === 0 ? images.length - 1 : currentIndex - 1;
    set({
      currentIndex: prevIndex,
      currentImage: images[prevIndex],
    });
  },

  setCurrentIndex: (index: number) => {
    const { images, activeToolId } = get();
    if (activeToolId) return;

    if (index >= 0 && index < images.length) {
      set({
        currentIndex: index,
        currentImage: images[index],
      });
    }
  },

  setActiveTool: (toolId: string | null) => {
    set({ activeToolId: toolId });
  },

  setToolState: (toolId: string, state: any) => {
    set((prev) => ({
      toolState: {
        ...prev.toolState,
        [toolId]: state,
      },
    }));
  },

  getToolState: <T>(toolId: string): T | undefined => {
    return get().toolState[toolId] as T | undefined;
  },

  clearToolState: (toolId: string) => {
    set((prev) => {
      const newToolState = { ...prev.toolState };
      delete newToolState[toolId];
      return { toolState: newToolState };
    });
  },
}));
