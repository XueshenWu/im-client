/**
 * Local SQLite database service
 * Handles all database operations for local mode
 */

import { ExifData } from '@/types/api';
import { LocalImage, SyncMetadata } from '../types/local';


class LocalDatabaseService {
  private isInitialized = false;

  /**
   * Initialize the database (create tables if not exist)
   */
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

  /**
   * Get all local images
   */
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

  /**
   * Get image by UUID
   */
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

  /**
   * Get paginated images
   */
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

  /**
   * Insert new image
   */
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

  /**
   * Insert multiple images
   */
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

  /**
   * Update image metadata
   */
  async updateImage(uuid: string, updates: Partial<LocalImage>): Promise<void> {
    await this.ensureInitialized();
    try {
      await window.electronAPI?.db.updateImage(uuid, updates);
    } catch (error) {
      console.error('[LocalDB] Failed to update image:', error);
      throw error;
    }
  }

  /**
   * Delete image by UUID
   */
  async deleteImage(uuid: string): Promise<void> {
    await this.ensureInitialized();
    try {
      await window.electronAPI?.db.deleteImage(uuid);
    } catch (error) {
      console.error('[LocalDB] Failed to delete image:', error);
      throw error;
    }
  }

  /**
   * Delete multiple images by UUIDs
   * 

   */
  async deleteImages(uuids: string[]): Promise<void> {
    await this.ensureInitialized();
    try {
      await window.electronAPI?.db.deleteImages(uuids);

    } catch (error) {
      console.error('[LocalDB] Failed to delete images:', error);
      throw error;
    }
  }

  /**
   * Get sync metadata
   */
  async getSyncMetadata(): Promise<SyncMetadata> {
    await this.ensureInitialized();
    try {
      const metadata = await window.electronAPI?.db.getSyncMetadata();
      return metadata || { lastSyncSequence: 0, lastSyncTime: null };
    } catch (error) {
      console.error('[LocalDB] Failed to get sync metadata:', error);
      return { lastSyncSequence: 0, lastSyncTime: null };
    }
  }

  /**
   * Update sync metadata
   */
  async updateSyncMetadata(metadata: Partial<SyncMetadata>): Promise<void> {
    await this.ensureInitialized();
    try {
      await window.electronAPI?.db.updateSyncMetadata(metadata);
    } catch (error) {
      console.error('[LocalDB] Failed to update sync metadata:', error);
      throw error;
    }
  }

  /**
   * Clear all images (for testing/reset)
   */
  async clearAllImages(): Promise<void> {
    await this.ensureInitialized();
    try {
      await window.electronAPI?.db.clearAllImages();
    } catch (error) {
      console.error('[LocalDB] Failed to clear all images:', error);
      throw error;
    }
  }

  /**
   * Search images by filename
   */
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

}

// Singleton instance
export const localDatabase = new LocalDatabaseService();
