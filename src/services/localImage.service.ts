port { localDatabase } from './localDatabase.service';
import { LocalImage } from '../types/local';
import { Image, ExifData } from '../types/api';


class LocalImageService {

  // Add images to local storage
  async addImages(images: LocalImage[]): Promise<LocalImage[]> {
    try {
      const inserted = await localDatabase.insertImages(images);
      await localDatabase.markLocalStateModified(); // Mark local state as changed
      console.log(`[LocalImage] Added ${inserted.length} images to local storage`);
      return inserted;
    } catch (error) {
      console.error('[LocalImage] Failed to add images:', error);
      throw error;
    }
  }


  // Add single image
  async addImage(image: LocalImage): Promise<LocalImage> {
    try {
      const inserted = await localDatabase.insertImage(image);
      const exifData = image.exifData;
      if (exifData) {
        await localDatabase.upsertExifData(inserted.uuid, exifData);
      }
      await localDatabase.markLocalStateModified();
      console.log('[LocalImage] Added image:', inserted.uuid);
      return inserted;
    } catch (error) {
      console.error('[LocalImage] Failed to add image:', error);
      throw error;
    }
  }


  // Get all local images
  async getAllImages(): Promise<LocalImage[]> {
    try {
      return await localDatabase.getAllImages();
    } catch (error) {
      console.error('[LocalImage] Failed to get all images:', error);
      return [];
    }
  }


  // Get image by UUID
  async getImageByUuid(uuid: string): Promise<LocalImage | null> {
    try {
      return await localDatabase.getImageByUuid(uuid);
    } catch (error) {
      console.error('[LocalImage] Failed to get image by UUID:', error);
      return null;
    }
  }


  // Get paginated images
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


  // Update image metadata
  async updateImage(uuid: string, updates: Partial<LocalImage>): Promise<void> {
    try {
      await localDatabase.updateImage(uuid, updates);
      await localDatabase.markLocalStateModified(); // Mark local state as changed
      console.log('[LocalImage] Updated image:', uuid);
    } catch (error) {
      console.error('[LocalImage] Failed to update image:', error);
      throw error;
    }
  }


  // Delete image from disk, set deletedAt in database
  async deleteImage(uuid: string): Promise<void> {
    try {
      const image = await localDatabase.getImageByUuid(uuid);

      // Update database
      await localDatabase.deleteImage(uuid);
      await localDatabase.markLocalStateModified();

      // Delete the actual file from disk
      if (image) {
        await window.electronAPI?.deleteLocalFiles([{
          uuid: image.uuid,
          format: image.format
        }]);
        console.log(`[LocalImage] Deleted file from disk: ${uuid}`);
      }

      console.log('[LocalImage] Deleted image (tombstoned in DB, file removed):', uuid);
    } catch (error) {
      console.error('[LocalImage] Failed to delete image:', error);
      throw error;
    }
  }


  // Delete multiple images
  async deleteImages(uuids: string[]): Promise<void> {
    try {
      const imageFormats = await window.electronAPI?.db.getImageFormatByUUIDs(uuids);
      await localDatabase.deleteImages(uuids);
      await localDatabase.markLocalStateModified(); 

      // Delete the actual files from disk
      if (imageFormats && imageFormats.length > 0) {
        const filesToDelete = imageFormats.map(img => ({
          uuid: img.uuid,
          format: img.format
        }));

        await window.electronAPI?.deleteLocalFiles(filesToDelete);
        console.log(`[LocalImage] Deleted ${filesToDelete.length} files from disk`);
      }

      console.log(`[LocalImage] Deleted ${uuids.length} images (tombstoned in DB, files removed)`);
    } catch (error) {
      console.error('[LocalImage] Failed to delete images:', error);
      throw error;
    }
  }

  
  // Search images by filename
  async searchImages(query: string): Promise<LocalImage[]> {
    try {
      return await localDatabase.searchImages(query);
    } catch (error) {
      console.error('[LocalImage] Failed to search images:', error);
      return [];
    }
  }


  // Export images to a directory
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

      return {
        success: result.success,
        results: result.results ?? []
      };


    } catch (error) {
      console.error('[LocalImage] Failed to export images:', error);
      return { success: false, results: [] };
    }
  }


  // Clear all local images
  async clearAll(): Promise<void> {
    try {
      await localDatabase.clearAllImages();
      console.log('[LocalImage] Cleared all images');
    } catch (error) {
      console.error('[LocalImage] Failed to clear all images:', error);
      throw error;
    }
  }


  // Convert server Image to LocalImage format when pulling from cloud
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


  // Convert LocalImage to server Image format when pushing to cloud
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



  // Get EXIF data for a local image by UUID
  async getLocalImageExifData(uuid: string): Promise<ExifData | null> {
    try {
      const exifData = await localDatabase.getExifData(uuid);
      return exifData;
    } catch (error) {
      console.error('[LocalImage] Failed to get EXIF data:', error);
      return null;
    }
  }


  // Get all local images with EXIF data for LWW sync diff calculation
  async getLocalLWWMetadata(): Promise<Image[]> {
    try {
      const localImages = await localDatabase.getAllImagesWithExif();

      const images: Image[] = localImages.map((localImage) => ({
        id: 0, // Local images don't have server ID
        uuid: localImage.uuid,
        filename: localImage.filename,
        fileSize: localImage.fileSize,
        format: localImage.format,
        width: localImage.width,
        height: localImage.height,
        hash: localImage.hash,
        mimeType: localImage.mimeType,
        isCorrupted: localImage.isCorrupted,
        createdAt: localImage.createdAt,
        updatedAt: localImage.updatedAt,
        deletedAt: localImage.deletedAt,
        exifData: localImage.exifData,
        pageCount: localImage.pageCount,
        tiffDimensions: localImage.tiffDimensions,
      }));

      console.log(`[LocalImage] Retrieved ${images.length} images with EXIF data for LWW sync`);
      return images;
    } catch (error) {
      console.error('[LocalImage] Failed to get local LWW metadata:', error);
      return [];
    }
  }


}


export const localImageService = new LocalImageService();
