/**
 * Local sync service for push/pull operations between local and cloud
 */

import { localImageService } from './localImage.service';
import { localDatabase } from './localDatabase.service';
import { stateDiffService } from './stateDiff.service';
import { getImages, deleteImages, updateImageExif, replaceImages, requestPresignedURLs, uploadToPresignedURL } from './images.service';
import { getSyncStatus } from './sync.service';
import { LocalImage, StateDiff } from '../types/local';
import { ExifData, Image } from '../types/api';
import api from './api';

class LocalSyncService {
  /**
   * Check sync status
   * Returns local seq, server seq, and whether they match
   */
  async checkSyncStatus(): Promise<{
    localSeq: number;
    serverSeq: number;
    inSync: boolean;
  }> {
    try {
      const metadata = await localDatabase.getSyncMetadata();
      const localSeq = metadata.lastSyncSequence;

      const syncStatus = await getSyncStatus();
      const serverSeq = syncStatus.currentSequence;

      return {
        localSeq,
        serverSeq,
        inSync: localSeq === serverSeq,
      };
    } catch (error) {
      console.error('[LocalSync] Failed to check sync status:', error);
      throw error;
    }
  }


  async getLWWSyncMetaData(): Promise<Image[]> {
    try {
      const res = await api.get<{
        images: Image[],
        exifData: ExifData[]
      }>("/api/sync/lwwSyncMetadata")

      if (res.data.images.length !== res.data.exifData.length) {
        console.log('images and exifData array length not matched')
        throw new Error('images and exifData array length not matched')
      }

      const { images, exifData } = res.data

      const zipped = images.map((image, index) => {
        return {
          ...image,
          exifData: exifData[index]
        }
      })


      return zipped
    } catch (error: any) {
      console.log(error)
      throw error
    }
  }


  async syncLWW(): Promise<{
    success: boolean;
    message: string;
    newSeq?: number;
    diff?: StateDiff;
  }> {

    try {
      // step1: check sequence numbers
      const status = await this.checkSyncStatus();
      if (status.inSync) {
        return {
          success: true,
          message: "Local is in sync with server"
        }
      }

      // step2: get local and remote images
      const localImages = await localImageService.getLocalLWWMetadata();
      const remoteImages = await getImages();

      // step3: calculate bi-directional diff
      const diff = stateDiffService.calculateDiff(localImages, remoteImages);

      console.log('[LocalSync] Diff calculated:', {
        toUpload: diff.toUpload.length,
        toDownload: diff.toDownload.length,
        toDeleteLocal: diff.toDeleteLocal.length,
        toDeleteRemote: diff.toDeleteRemote.length,
        toUpdateRemote: diff.toUpdateRemote.length,
        toUpdateLocal: diff.toUpdateLocal.length,
        toReplaceRemote: diff.toReplaceRemote.length,
        toReplaceLocal: diff.toReplaceLocal.length,
      });

      // step4: execute sync plan - PULL operations first (remote -> local)
      console.log('[LocalSync] Starting PULL operations...');

      // Pull: Delete local
      if (diff.toDeleteLocal.length > 0) {
        console.log(`[LocalSync] Deleting ${diff.toDeleteLocal.length} local images`);
        await localImageService.deleteImages(diff.toDeleteLocal);
      }

      // Pull: Download new images
      if (diff.toDownload.length > 0) {
        console.log(`[LocalSync] Downloading ${diff.toDownload.length} new images`);
        await this.downloadImagesFromCloud(diff.toDownload);
      }

      // Pull: Update local metadata
      if (diff.toUpdateLocal.length > 0) {
        console.log(`[LocalSync] Updating ${diff.toUpdateLocal.length} local metadata`);
        await this.updateLocalMetadata(diff.toUpdateLocal);
      }

      // Pull: Replace local images
      if (diff.toReplaceLocal.length > 0) {
        console.log(`[LocalSync] Replacing ${diff.toReplaceLocal.length} local images`);
        await this.replaceLocalImages(diff.toReplaceLocal);
      }

      // step5: execute sync plan - PUSH operations (local -> remote)
      console.log('[LocalSync] Starting PUSH operations...');

      // Push: Delete remote
      if (diff.toDeleteRemote.length > 0) {
        console.log(`[LocalSync] Deleting ${diff.toDeleteRemote.length} remote images`);
        await this.deleteRemoteImages(diff.toDeleteRemote);
      }

      // Push: Upload new images
      if (diff.toUpload.length > 0) {
        console.log(`[LocalSync] Uploading ${diff.toUpload.length} new images`);
        await this.uploadImagesToCloud(diff.toUpload);
      }

      // Push: Update remote metadata
      if (diff.toUpdateRemote.length > 0) {
        console.log(`[LocalSync] Updating ${diff.toUpdateRemote.length} remote metadata`);
        await this.updateRemoteMetadata(diff.toUpdateRemote);
      }

      // Push: Replace remote images
      if (diff.toReplaceRemote.length > 0) {
        console.log(`[LocalSync] Replacing ${diff.toReplaceRemote.length} remote images`);
        await this.replaceRemoteImages(diff.toReplaceRemote);
      }

      // step6: update sync metadata
      const finalStatus = await getSyncStatus();
      await localDatabase.updateSyncMetadata({
        lastSyncSequence: finalStatus.currentSequence,
        lastSyncTime: new Date().toISOString(),
      });

      console.log('[LocalSync] LWW sync completed successfully');
      return {
        success: true,
        message: 'LWW sync completed successfully',
        newSeq: finalStatus.currentSequence,
        diff,
      };

    } catch (error) {
      console.error('[LocalSync] Sync failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }


  /**
   * Upload local images to cloud
   */
  private async uploadImagesToCloud(localImages: LocalImage[]): Promise<void> {
    if (localImages.length === 0) return;

    try {
      console.log(`[LocalSync] Preparing to upload ${localImages.length} images...`);

      // Prepare image metadata for presigned URL request
      const imageMetadata = localImages.map(img => ({
        uuid: img.uuid,
        filename: img.filename,
        fileSize: img.fileSize,
        format: img.format,
        width: img.width,
        height: img.height,
        hash: img.hash,
        mimeType: img.mimeType,
        isCorrupted: img.isCorrupted,
        createdAt: img.createdAt,
        updatedAt: img.updatedAt,
        deletedAt: img.deletedAt,
        exifData: img.exifData,
        pageCount: img.pageCount,
        tiffDimensions: img.tiffDimensions,
      }));

      // Request presigned URLs
      const presignedData = await requestPresignedURLs(imageMetadata);

      // Upload each image and thumbnail
      const { generateThumbnailBlob } = await import('@/utils/thumbnailGenerator');

      for (let i = 0; i < localImages.length; i++) {
        const localImage = localImages[i];
        const presigned = presignedData[i];

        try {
          // Read image file
          const imageBuffer = await window.electronAPI?.loadLocalImage(localImage.uuid, localImage.format);
          if (!imageBuffer) {
            console.error(`[LocalSync] Failed to read image: ${localImage.filename}`);
            continue;
          }

          // Convert Buffer to ArrayBuffer
          const arrayBuffer = imageBuffer.buffer.slice(
            imageBuffer.byteOffset,
            imageBuffer.byteOffset + imageBuffer.byteLength
          ) as ArrayBuffer;
          const imageBlob = new Blob([arrayBuffer], { type: localImage.mimeType });

          // Generate thumbnail
          const thumbnailBlob = await generateThumbnailBlob(imageBlob, 300);

          // Upload thumbnail
          await uploadToPresignedURL(presigned.thumbnailUrl, thumbnailBlob, true);

          // Upload image
          await uploadToPresignedURL(presigned.imageUrl, imageBlob, false);

          console.log(`[LocalSync] ✓ Uploaded: ${localImage.filename}`);
        } catch (error) {
          console.error(`[LocalSync] Failed to upload ${localImage.filename}:`, error);
        }
      }

      console.log(`[LocalSync] Upload completed: ${localImages.length} images`);
    } catch (error) {
      console.error('[LocalSync] Batch upload failed:', error);
      throw error;
    }
  }

  /**
   * Download images from cloud to local storage
   */
  private async downloadImagesFromCloud(remoteImages: Image[]): Promise<void> {
    if (remoteImages.length === 0) return;

    try {
      console.log(`[LocalSync] Downloading ${remoteImages.length} images from cloud...`);

      for (const remoteImage of remoteImages) {
        try {
          // Download image using presignedUrl if available, otherwise construct URL
          let imageUrl: string;
          let thumbnailUrl: string;

          if (remoteImage.presignedUrl) {
            // Use presigned URL directly
            imageUrl = remoteImage.presignedUrl;
            // For thumbnail, we'll need to construct it or get it separately
            thumbnailUrl = remoteImage.presignedUrl.replace('/images/', '/thumbnails/');
          } else {
            // Construct URLs from API base
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
            imageUrl = `${API_URL}/api/images/${remoteImage.uuid}/download`;
            thumbnailUrl = `${API_URL}/api/images/${remoteImage.uuid}/thumbnail`;
          }

          // Download image
          const imageResponse = await fetch(imageUrl);
          if (!imageResponse.ok) {
            throw new Error(`Failed to download image: ${imageResponse.statusText}`);
          }
          const imageBlob = await imageResponse.blob();

          // Download thumbnail
          const thumbnailResponse = await fetch(thumbnailUrl);
          if (!thumbnailResponse.ok) {
            console.warn(`Failed to download thumbnail for ${remoteImage.filename}, will generate locally`);
          }
          const thumbnailBlob = thumbnailResponse.ok ? await thumbnailResponse.blob() : null;

          // Save to local storage via Electron
          const imageBuffer = await imageBlob.arrayBuffer();
          await window.electronAPI?.saveImageBuffer(remoteImage.uuid, remoteImage.format, imageBuffer);

          if (thumbnailBlob) {
            const thumbnailBuffer = await thumbnailBlob.arrayBuffer();
            await window.electronAPI?.saveThumbnailBuffer(remoteImage.uuid, thumbnailBuffer);
          }

          // Add to local database
          await localImageService.addImage({
            uuid: remoteImage.uuid,
            filename: remoteImage.filename,
            format: remoteImage.format,
            fileSize: remoteImage.fileSize,
            width: remoteImage.width,
            height: remoteImage.height,
            hash: remoteImage.hash,
            mimeType: remoteImage.mimeType,
            isCorrupted: remoteImage.isCorrupted,
            createdAt: remoteImage.createdAt,
            updatedAt: remoteImage.updatedAt,
            deletedAt: remoteImage.deletedAt,
            exifData: remoteImage.exifData,
            pageCount: remoteImage.pageCount,
            tiffDimensions: remoteImage.tiffDimensions,
          });

          console.log(`[LocalSync] ✓ Downloaded: ${remoteImage.filename}`);
        } catch (error) {
          console.error(`[LocalSync] Failed to download ${remoteImage.filename}:`, error);
        }
      }

      console.log(`[LocalSync] Download completed: ${remoteImages.length} images`);
    } catch (error) {
      console.error('[LocalSync] Download failed:', error);
      throw error;
    }
  }

  /**
   * Replace local images with remote versions
   */
  private async replaceLocalImages(remoteImages: Image[]): Promise<void> {
    if (remoteImages.length === 0) return;

    try {
      // First delete the old local versions
      const uuids = remoteImages.map(img => img.uuid);
      await localImageService.deleteImages(uuids);

      // Then download the new versions
      await this.downloadImagesFromCloud(remoteImages);

      console.log(`[LocalSync] Replaced ${remoteImages.length} local images`);
    } catch (error) {
      console.error('[LocalSync] Failed to replace local images:', error);
      throw error;
    }
  }

  /**
   * Update local metadata from remote
   */
  private async updateLocalMetadata(updateImages: Image[]): Promise<void> {

    const updatePromises = updateImages.map(async (image) => {
      try {
        await localImageService.updateImage(image.uuid, {
          filename: image.filename,
          format: image.format,
          fileSize: image.fileSize,
          width: image.width,
          height: image.height,
          hash: image.hash,
          mimeType: image.mimeType,
          isCorrupted: image.isCorrupted,
          createdAt: image.createdAt,
          updatedAt: image.updatedAt,
          deletedAt: image.deletedAt,
          exifData: image.exifData,
          pageCount: image.pageCount,
          tiffDimensions: image.tiffDimensions,
        })
        console.log(`[LocalSync] Updated local metadata: ${image.filename}`);
      } catch (error) {
        console.error(`[LocalSync] Failed to update local metadata ${image.filename}:`, error);
      }
    });


    await Promise.all(updatePromises);
  }

  /**
   * Update remote metadata from local
   */
  private async updateRemoteMetadata(localImages: LocalImage[]): Promise<void> {
    if (localImages.length === 0) return;

    try {
      // Update EXIF data for images that have it
      const exifUpdates = localImages
        .filter(img => img.exifData)
        .map(img => ({
          uuid: img.uuid,
          exifData: img.exifData!,
        }));

      if (exifUpdates.length > 0) {
        await updateImageExif(exifUpdates);
        console.log(`[LocalSync] Updated EXIF for ${exifUpdates.length} remote images`);
      }

      // Update other metadata fields
      const metadataPromises = localImages.map(async (img) => {
        try {
          await api.put(`/api/images/uuid/${img.uuid}`, {
            filename: img.filename,
            fileSize: img.fileSize,
            width: img.width,
            height: img.height,
            mimeType: img.mimeType,
            isCorrupted: img.isCorrupted,
            pageCount: img.pageCount,
            tiffDimensions: img.tiffDimensions,
            updatedAt: img.updatedAt,
          });
          console.log(`[LocalSync] Updated remote metadata: ${img.filename}`);
        } catch (error: any) {
          console.error(`[LocalSync] Failed to update remote ${img.filename}:`, error);
        }
      });

      await Promise.all(metadataPromises);
    } catch (error) {
      console.error('[LocalSync] Failed to update remote metadata:', error);
      throw error;
    }
  }

  /**
   * Delete remote images
   */
  private async deleteRemoteImages(uuids: string[]): Promise<void> {
    if (uuids.length === 0) return;

    try {
      const result = await deleteImages(uuids);
      console.log(`[LocalSync] Deleted ${result.stats.successful} remote images`);

      if (result.stats.failed > 0) {
        console.warn(`[LocalSync] Failed to delete ${result.stats.failed} remote images`);
      }
    } catch (error) {
      console.error('[LocalSync] Failed to delete remote images:', error);
      throw error;
    }
  }

  /**
   * Replace remote images with local versions
   */
  private async replaceRemoteImages(localImages: LocalImage[]): Promise<void> {
    if (localImages.length === 0) return;

    try {
      console.log(`[LocalSync] Preparing to replace ${localImages.length} remote images...`);

      // Prepare replacement data
      const replacements = await Promise.all(
        localImages.map(async (localImage) => {
          // Read image file
          const imageBuffer = await window.electronAPI?.loadLocalImage(localImage.uuid, localImage.format);
          if (!imageBuffer) {
            throw new Error(`Failed to read image: ${localImage.filename}`);
          }

          // Convert Buffer to ArrayBuffer
          const arrayBuffer = imageBuffer.buffer.slice(
            imageBuffer.byteOffset,
            imageBuffer.byteOffset + imageBuffer.byteLength
          ) as ArrayBuffer;

          const file = new Blob([arrayBuffer], { type: localImage.mimeType });

          return {
            uuid: localImage.uuid,
            file,
            metadata: {
              width: localImage.width,
              height: localImage.height,
              filename: localImage.filename,
              format: localImage.format,
              mimeType: localImage.mimeType,
              exifData: localImage.exifData,
              pageCount: localImage.pageCount,
              tiffDimensions: localImage.tiffDimensions,
            },
          };
        })
      );

      // Replace images using the API
      const result = await replaceImages(replacements);

      console.log(`[LocalSync] Replaced ${result.stats.successful} remote images`);

      if (result.stats.failed > 0) {
        console.warn(`[LocalSync] Failed to replace ${result.stats.failed} remote images`);
        result.errors.forEach(err => {
          console.error(`[LocalSync] Replace error for ${err.uuid}: ${err.error}`);
        });
      }
    } catch (error) {
      console.error('[LocalSync] Failed to replace remote images:', error);
      throw error;
    }
  }
}

// Singleton instance
export const localSyncService = new LocalSyncService();
