/**
 * Local image service for managing images in local mode
 * Handles file operations and database CRUD
 */

import { localDatabase } from './localDatabase.service';
import { LocalImage } from '../types/local';
import { Image } from '../types/api';

class LocalImageService {
  /**
   * Add images to local storage
   * Files should already be copied to AppData by Electron
   */
  async addImages(images: LocalImage[]): Promise<LocalImage[]> {
    try {
    
      const inserted = await localDatabase.insertImages(images);
      console.log(`[LocalImage] Added ${inserted.length} images to local storage`);
      return inserted;
    } catch (error) {
      console.error('[LocalImage] Failed to add images:', error);
      throw error;
    }
  }

  /**
   * Add single image
   */
  async addImage(image: LocalImage): Promise<LocalImage> {
    try {
 
      const inserted = await localDatabase.insertImage(image);
      console.log('[LocalImage] Added image:', inserted.uuid);
      return inserted;
    } catch (error) {
      console.error('[LocalImage] Failed to add image:', error);
      throw error;
    }
  }

  /**
   * Get all local images
   */
  async getAllImages(): Promise<LocalImage[]> {
    try {
      return await localDatabase.getAllImages();
    } catch (error) {
      console.error('[LocalImage] Failed to get all images:', error);
      return [];
    }
  }

  /**
   * Get image by UUID
   */
  async getImageByUuid(uuid: string): Promise<LocalImage | null> {
    try {
      return await localDatabase.getImageByUuid(uuid);
    } catch (error) {
      console.error('[LocalImage] Failed to get image by UUID:', error);
      return null;
    }
  }

  /**
   * Get paginated images
   */
  async getPaginatedImages(
    page: number,
    pageSize: number
  ): Promise<{ images: LocalImage[]; total: number }> {
    try {
      return await localDatabase.getPaginatedImages(page, pageSize);
    } catch (error) {
      console.error('[LocalImage] Failed to get paginated images:', error);
      return { images: [], total: 0 };
    }
  }

  /**
   * Update image metadata
   */
  async updateImage(uuid: string, updates: Partial<LocalImage>): Promise<void> {
    try {
      await localDatabase.updateImage(uuid, updates);
      console.log('[LocalImage] Updated image:', uuid);
    } catch (error) {
      console.error('[LocalImage] Failed to update image:', error);
      throw error;
    }
  }

  /**
   * Delete image
   * Removes from database but keeps file in AppData
   */
  async deleteImage(uuid: string): Promise<void> {
    try {
      await localDatabase.deleteImage(uuid);
      console.log('[LocalImage] Deleted image:', uuid);
    } catch (error) {
      console.error('[LocalImage] Failed to delete image:', error);
      throw error;
    }
  }

  /**
   * Delete multiple images
   * 
   * - Delete db records
   * - Delete files
   */
  async deleteImages(uuids: string[]): Promise<void> {
    try {
      await localDatabase.deleteImages(uuids);
      console.log(`[LocalImage] Deleted ${uuids.length} images`);
    } catch (error) {
      console.error('[LocalImage] Failed to delete images:', error);
      throw error;
    }
  }

  /**
   * Search images by filename
   */
  async searchImages(query: string): Promise<LocalImage[]> {
    try {
      return await localDatabase.searchImages(query);
    } catch (error) {
      console.error('[LocalImage] Failed to search images:', error);
      return [];
    }
  }

  /**
   * Export images to a directory
   */
  async exportImages(
    uuids: string[],
    destination: string
  ): Promise<{ success: boolean; results: any[] }> {
    try {
      const images = [];
      for (const uuid of uuids) {
        const image = await this.getImageByUuid(uuid);
        if (image) {
          images.push({
            uuid: image.uuid,
            format: image.format,
            filename: image.filename,
          });
        }
      }

      if (images.length === 0) {
        return { success: true, results: [] };
      }

      const result = await window.electronAPI?.exportImages(images, destination);

      if (!result) {
        return { success: false, results: [] };
      }

      // Return the result, but force 'results' to be an empty array if it's missing
      return {
        success: result.success,
        results: result.results ?? []
      };


    } catch (error) {
      console.error('[LocalImage] Failed to export images:', error);
      return { success: false, results: [] };
    }
  }

  /**
   * Clear all local images (for testing/reset)
   */
  async clearAll(): Promise<void> {
    try {
      await localDatabase.clearAllImages();
      console.log('[LocalImage] Cleared all images');
    } catch (error) {
      console.error('[LocalImage] Failed to clear all images:', error);
      throw error;
    }
  }

  /**
   * Convert server Image to LocalImage format
   * Used when pulling from cloud
   */
  serverImageToLocal(serverImage: Image): LocalImage {
    return {
      uuid: serverImage.uuid,
      filename: serverImage.filename,
      fileSize: serverImage.fileSize,
      format: serverImage.format,
      width: serverImage.width,
      height: serverImage.height,
      hash: serverImage.hash,
      exifData: serverImage.exifData,
      isCorrupted: serverImage.isCorrupted,
      createdAt: serverImage.createdAt,
      updatedAt: serverImage.updatedAt,
      deletedAt: serverImage.deletedAt,
      mimeType: serverImage.mimeType,
    };
  }

  /**
   * Convert LocalImage to server Image format
   * Used when pushing to cloud
   */
  localImageToServer(localImage: LocalImage): Omit<Image, 'id'> {
    return {
      uuid: localImage.uuid,
      filename: localImage.filename,
      fileSize: localImage.fileSize,
      format: localImage.format,
      width: localImage.width,
      height: localImage.height,
      hash: localImage.hash,
      updatedAt: localImage.updatedAt,
      exifData: localImage.exifData,
      isCorrupted: localImage.isCorrupted,
      createdAt: localImage.createdAt,
      deletedAt: localImage.deletedAt,
      mimeType: localImage.mimeType,
    };
  }
}

// Singleton instance
export const localImageService = new LocalImageService();
