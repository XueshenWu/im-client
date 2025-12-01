import { ExifData } from '@/types/api';
import { LocalImage, SyncMetadata } from '../types/local';


function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

class LocalDatabaseService {
  private isInitialized = false;

  //create tables if not exist
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await window.electronAPI?.db.initialize();
      this.isInitialized = true;
      console.log('[LocalDB] Database initialized');
    } catch (error) {
      console.error('[LocalDB] Failed to initialize:', error);
      throw error;
    }
  }


  // Get all local images
  async getAllImages(): Promise<LocalImage[]> {
    await this.ensureInitialized();
    try {
      const images = await window.electronAPI?.db.getAllImages();
      return images || [];
    } catch (error) {
      console.error('[LocalDB] Failed to get all images:', error);
      return [];
    }
  }


  // Get image by UUID
  async getImageByUuid(uuid: string): Promise<LocalImage | null> {
    await this.ensureInitialized();
    try {
      const image = await window.electronAPI?.db.getImageByUuid(uuid);
      return image || null;
    } catch (error) {
      console.error('[LocalDB] Failed to get image by UUID:', error);
      return null;
    }
  }


  // Get paginated images
  async getPaginatedImages(
    page: number,
    pageSize: number,
    sortBy?: 'filename' | 'fileSize' | 'format' | 'updatedAt' | 'createdAt',
    sortOrder?: 'asc' | 'desc'
  ): Promise<{ images: LocalImage[]; total: number }> {
    await this.ensureInitialized();
    try {
      const result = await window.electronAPI?.db.getPaginatedImages(page, pageSize, sortBy, sortOrder);
      return result || { images: [], total: 0 };
    } catch (error) {
      console.error('[LocalDB] Failed to get paginated images:', error);
      return { images: [], total: 0 };
    }
  }


  // Insert new image
  async insertImage(image: LocalImage): Promise<LocalImage> {
    await this.ensureInitialized();
    try {
      const inserted = await window.electronAPI?.db.insertImage(image);
      if (!inserted) throw new Error('Failed to insert image');
      return inserted;
    } catch (error) {
      console.error('[LocalDB] Failed to insert image:', error);
      throw error;
    }
  }


   // Insert multiple images
  async insertImages(images: LocalImage[]): Promise<LocalImage[]> {
    await this.ensureInitialized();
    try {
      const inserted = await window.electronAPI?.db.insertImages(images);
      return inserted || [];
    } catch (error) {
      console.error('[LocalDB] Failed to insert images:', error);
      throw error;
    }
  }


  // Update image metadata
  async updateImage(uuid: string, updates: Partial<LocalImage>): Promise<void> {
    await this.ensureInitialized();
    try {
      await window.electronAPI?.db.updateImage(uuid, updates);
    } catch (error) {
      console.error('[LocalDB] Failed to update image:', error);
      throw error;
    }
  }


  // Delete image by UUID
  async deleteImage(uuid: string): Promise<void> {
    await this.ensureInitialized();
    try {
      await window.electronAPI?.db.deleteImage(uuid);
    } catch (error) {
      console.error('[LocalDB] Failed to delete image:', error);
      throw error;
    }
  }


  // Delete multiple images by UUIDs
  async deleteImages(uuids: string[]): Promise<void> {
    await this.ensureInitialized();
    try {
      await window.electronAPI?.db.deleteImages(uuids);

    } catch (error) {
      console.error('[LocalDB] Failed to delete images:', error);
      throw error;
    }
  }


  // Get sync metadata
  async getSyncMetadata(): Promise<SyncMetadata> {
    await this.ensureInitialized();
    try {
      const metadata = await window.electronAPI?.db.getSyncMetadata();
      return metadata || { lastSyncSequence: 0, lastSyncTime: null, lastSyncUUID: null };
    } catch (error) {
      console.error('[LocalDB] Failed to get sync metadata:', error);
      return { lastSyncSequence: 0, lastSyncTime: null, lastSyncUUID: null };
    }
  }

  // Update sync metadata
  async updateSyncMetadata(metadata: { lastSyncSequence?: number; lastSyncTime?: string | null; lastSyncUUID?: string | null }): Promise<void> {
    await this.ensureInitialized();
    try {
      await window.electronAPI?.db.updateSyncMetadata(metadata);
      console.log('[LocalDB] Sync metadata updated');
    } catch (error) {
      console.error('[LocalDB] Failed to update sync metadata:', error);
      throw error;
    }
  }


  // Mark local state as modified by generating a new sync UUID
  async markLocalStateModified(): Promise<void> {
    await this.ensureInitialized();
    try {
      const newUUID = generateUUID();
      await this.updateSyncMetadata({
        lastSyncUUID: newUUID,
      });
      console.log(`[LocalDB] Local state marked as modified with new UUID: ${newUUID.substring(0, 8)}...`);
    } catch (error) {
      console.error('[LocalDB] Failed to mark local state as modified:', error);
      throw error;
    }
  }


  // Clear all images
  async clearAllImages(): Promise<void> {
    await this.ensureInitialized();
    try {
      await window.electronAPI?.db.clearAllImages();
    } catch (error) {
      console.error('[LocalDB] Failed to clear all images:', error);
      throw error;
    }
  }


  // Search images by filename
  async searchImages(query: string): Promise<LocalImage[]> {
    await this.ensureInitialized();
    try {
      const images = await window.electronAPI?.db.searchImages(query);
      return images || [];
    } catch (error) {
      console.error('[LocalDB] Failed to search images:', error);
      return [];
    }
  }


  // Get EXIF data for an image by UUID
  async getExifData(uuid: string): Promise<ExifData | null> {
    await this.ensureInitialized();
    try {
      const exifData = await window.electronAPI?.db.getExifData(uuid);
      return exifData || null;
    } catch (error) {
      console.error('[LocalDB] Failed to get EXIF data:', error);
      return null;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  upsertExifData = async (uuid: string, exif: ExifData): Promise<boolean> => {
    await this.ensureInitialized();
    try {
      const res = await window.electronAPI?.db.upsertExifData(uuid, exif);
      if (!res) throw new Error('Failed to upsert EXIF data');
      return true
    } catch (error) {
      console.error('[LocalDB] Failed to upsert EXIF data:', error);
      throw error;
    }
  }

 
  // Get all images with EXIF data for LWW sync diff calculation
  async getAllImagesWithExif(): Promise<LocalImage[]> {
    await this.ensureInitialized();
    try {
      const images = await window.electronAPI?.db.getAllImagesWithExif();
      return images || [];
    } catch (error) {
      console.error('[LocalDB] Failed to get all images with EXIF:', error);
      return [];
    }
  }

}


export const localDatabase = new LocalDatabaseService();
