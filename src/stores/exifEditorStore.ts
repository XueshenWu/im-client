import { create } from 'zustand';
import type { ExifData } from '@/types/api';
import type { ImageWithSource } from '@/types/gallery';
import { localImageService } from '@/services/localImage.service';
import { localDatabase } from '@/services/localDatabase.service';
import { getExifByUuid, getImagesByUuid, updateImageExif } from '@/services/images.service';

interface ExifEditorStore {
  isOpen: boolean;
  image: ImageWithSource | null;
  exifData: Partial<ExifData>;
  originalExifData: Partial<ExifData>;
  hasChanges: boolean;
  openEditor: (image: ImageWithSource) => Promise<void>;
  closeEditor: () => void;
  updateField: (field: keyof ExifData, value: any) => void;
  saveChanges: () => Promise<void>;
  discardChanges: () => void;
}

export const useExifEditorStore = create<ExifEditorStore>((set, get) => ({
  isOpen: false,
  image: null,
  exifData: {},
  originalExifData: {},
  hasChanges: false,

  openEditor: async (image: ImageWithSource) => {
    try {
      let exifData: Partial<ExifData> = {};

      if (image.source === 'local') {
        // Load EXIF data from local database (separate query for performance)
        exifData = await localImageService.getLocalImageExifData(image.uuid) || {};
      } else {
        // Load EXIF data from cloud API
        const exif = await getExifByUuid(image.uuid);
        if (!exif) {
          console.log('failed to get exif response')
          return
        } else {
          exifData = exif

        }
      }

      set({
        isOpen: true,
        image,
        exifData: { ...exifData },
        originalExifData: { ...exifData },
        hasChanges: false,
      });
    } catch (error) {
      console.error('Failed to load EXIF data:', error);
    }
  },

  closeEditor: () => {
    set({
      isOpen: false,
      image: null,
      exifData: {},
      originalExifData: {},
      hasChanges: false,
    });
  },

  updateField: (field: keyof ExifData, value: any) => {
    set((state) => ({
      exifData: {
        ...state.exifData,
        [field]: value || null,
      },
      hasChanges: true,
    }));
  },

  saveChanges: async () => {
    const { image, exifData } = get();

    if (!image) {
      console.warn('Cannot save: no image loaded');
      return;
    }

    try {
      // Ensure all date fields are properly serialized as ISO strings
      const sanitizedExifData: Partial<ExifData> = { ...exifData };

      // Convert any Date objects to ISO strings
      if (sanitizedExifData.dateTaken && typeof sanitizedExifData.dateTaken !== 'string') {
        sanitizedExifData.dateTaken = new Date(sanitizedExifData.dateTaken).toISOString();
      }

      if (image.source === 'local') {
        // Update EXIF data in local database
        await localDatabase.upsertExifData(image.uuid, sanitizedExifData as ExifData);

        // Update only the updatedAt timestamp in the images table
        await localImageService.updateImage(image.uuid, {
          updatedAt: new Date().toISOString(),
        });
      } else {

        // Update EXIF data via cloud API
        const result = await updateImageExif([{
          uuid: image.uuid,
          exifData: sanitizedExifData as ExifData,
        }]);

        if (result.errors.length > 0) {
          throw new Error(`Failed to update EXIF: ${result.errors[0].error}`);
        }
      }

      set({
        hasChanges: false,
        originalExifData: { ...sanitizedExifData },
      });

      console.log('EXIF data saved successfully');
    } catch (error) {
      console.error('Failed to save EXIF data:', error);
      throw error;
    }
  },

  discardChanges: () => {
    const { originalExifData } = get();
    set({
      exifData: { ...originalExifData },
      hasChanges: false,
    });
  },
}));
