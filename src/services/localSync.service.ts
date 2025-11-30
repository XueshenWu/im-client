/**
 * Local sync service for push/pull operations between local and cloud
 */

import { localImageService } from './localImage.service';
import { localDatabase } from './localDatabase.service';
import { stateDiffService } from './stateDiff.service';
import { getImages, deleteImages, updateImageExif, replaceImages, requestPresignedURLs, uploadToPresignedURL, requestDownloadUrls, getImagesForSync } from './images.service';
import { getSyncStatus, acquireLwwLock, releaseLwwLock } from './sync.service';
import { LocalImage, StateDiff, SyncProgressCallback, SyncProgress, SyncPhase } from '../types/local';
import { Image } from '../types/api';
import api, { lockManager } from './api';

class LocalSyncService {
  private syncInProgress = false;
  private progressCallback: SyncProgressCallback | null = null;

  /**
   * Set progress callback for sync operations
   */
  setProgressCallback(callback: SyncProgressCallback | null): void {
    this.progressCallback = callback;
  }

  /**
   * Report progress to the callback
   */
  private reportProgress(phase: SyncPhase, current: number, total: number, message: string): void {
    if (this.progressCallback) {
      // Calculate overall percentage based on phase weights
      const phaseWeights = {
        initializing: 5,
        calculating_diff: 5,
        pull_deleting: 5,
        pull_downloading: 20,
        pull_updating: 5,
        pull_replacing: 15,
        push_deleting: 5,
        push_uploading: 20,
        push_updating: 5,
        push_replacing: 15,
        finalizing: 5,
        completed: 100,
        failed: 0,
      };

      const phaseOrder: SyncPhase[] = [
        'initializing', 'calculating_diff',
        'pull_deleting', 'pull_downloading', 'pull_updating', 'pull_replacing',
        'push_deleting', 'push_uploading', 'push_updating', 'push_replacing',
        'finalizing', 'completed'
      ];

      const currentPhaseIndex = phaseOrder.indexOf(phase);
      const completedWeight = phaseOrder
        .slice(0, currentPhaseIndex)
        .reduce((sum, p) => sum + phaseWeights[p], 0);

      const currentPhaseProgress = total > 0
        ? (current / total) * phaseWeights[phase]
        : phaseWeights[phase];

      const percentage = Math.min(100, Math.round(completedWeight + currentPhaseProgress));

      const progress: SyncProgress = {
        phase,
        current,
        total,
        message,
        percentage,
      };

      this.progressCallback(progress);
    }
  }

  /**
   * Check sync status
   * Cloud mode: Uses sequence numbers
   * Local mode: Uses UUID-based tracking
   * Returns local/server identifiers and whether they match
   */
  async checkSyncStatus(mode: 'cloud' | 'local' = 'local'): Promise<{
    localSeq: number;
    serverSeq: number;
    localUUID: string | null;
    serverUUID: string | null;
    inSync: boolean;
  }> {
    try {
      const metadata = await localDatabase.getSyncMetadata();
      const localSeq = metadata.lastSyncSequence;
      const localUUID = metadata.lastSyncUUID || null;

      // Fetch current server status - this makes API call and extracts UUID from header
      const syncStatus = await getSyncStatus();
      const serverSeq = syncStatus.currentSequence;
      const serverUUID = syncStatus.syncUUID || null;

      console.log(`[LocalSync] Sync Status Check (${mode} mode):`, {
        localSeq,
        serverSeq,
        localUUID: localUUID ? `${localUUID.substring(0, 8)}...` : null,
        serverUUID: serverUUID ? `${serverUUID.substring(0, 8)}...` : null,
      });

      // Determine sync status based on mode
      let inSync: boolean;
      if (mode === 'cloud') {
        // Cloud mode: Use sequence number comparison
        inSync = localSeq === serverSeq;
      } else {
        // Local mode: Use UUID comparison
        // Both must exist and match
        inSync = !!localUUID && !!serverUUID && localUUID === serverUUID;
      }

      console.log(`[LocalSync] In Sync: ${inSync}`);

      return {
        localSeq,
        serverSeq,
        localUUID,
        serverUUID,
        inSync,
      };
    } catch (error) {
      console.error('[LocalSync] Failed to check sync status:', error);
      throw error;
    }
  }


  /**
   * Get LWW sync metadata from server
   * Uses the same endpoint as /api/images?withExif=true
   * Returns all images with EXIF data for sync comparison
   */
  async getLWWSyncMetaData(): Promise<Image[]> {
    try {
      // This endpoint returns the same data structure as /api/images?withExif=true
      // which is Image[] with embedded exifData
      const res = await api.get<Image[]>("/api/sync/lwwSyncMetadata")
      return res.data
    } catch (error: any) {
      console.error('[LocalSync] Failed to get LWW sync metadata:', error)
      throw error
    }
  }


  async syncLWW(): Promise<{
    success: boolean;
    message: string;
    newSeq?: number;
    diff?: StateDiff;
  }> {
    // Prevent concurrent sync operations
    if (this.syncInProgress) {
      return {
        success: false,
        message: 'Sync already in progress',
      };
    }

    this.syncInProgress = true;
    let lockUuid: string | null = null;

    try {
      // step1: check sequence numbers and acquire lock
      this.reportProgress('initializing', 0, 1, 'Checking sync status...');
      const status = await this.checkSyncStatus();

      // If sequences don't match, we need to acquire lock before syncing
      if (!status.inSync) {
        console.log('[LocalSync] Sequences out of sync. Acquiring lock...');
        this.reportProgress('initializing', 0, 1, 'Acquiring sync lock...');
        lockUuid = await acquireLwwLock();
        lockManager.setLockUuid(lockUuid);
        console.log(`[LocalSync] Lock acquired: ${lockUuid}`);
        this.reportProgress('initializing', 1, 1, 'Lock acquired');
      } else {
        console.log('[LocalSync] Sequences match, no sync needed');
        this.reportProgress('completed', 1, 1, 'Already in sync');
        return {
          success: true,
          message: "Local is in sync with server"
        };
      }

      // step2: get local and remote images
      this.reportProgress('calculating_diff', 0, 2, 'Fetching local metadata...');
      const localImages = await localImageService.getLocalLWWMetadata();

      this.reportProgress('calculating_diff', 1, 2, 'Fetching remote metadata...');
      const remoteImages = await getImagesForSync();

      // step3: calculate bi-directional diff
      this.reportProgress('calculating_diff', 2, 2, 'Calculating differences...');
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
        this.reportProgress('pull_deleting', 0, diff.toDeleteLocal.length, `Deleting ${diff.toDeleteLocal.length} local images...`);
        await localImageService.deleteImages(diff.toDeleteLocal);
        this.reportProgress('pull_deleting', diff.toDeleteLocal.length, diff.toDeleteLocal.length, 'Local deletions complete');
      }

      // Pull: Download new images
      if (diff.toDownload.length > 0) {
        console.log(`[LocalSync] Downloading ${diff.toDownload.length} new images`);
        await this.downloadImagesFromCloud(diff.toDownload, 'pull_downloading');
      }

      // Pull: Update local metadata
      if (diff.toUpdateLocal.length > 0) {
        console.log(`[LocalSync] Updating ${diff.toUpdateLocal.length} local metadata`);
        this.reportProgress('pull_updating', 0, diff.toUpdateLocal.length, `Updating ${diff.toUpdateLocal.length} local metadata...`);
        await this.updateLocalMetadata(diff.toUpdateLocal);
        this.reportProgress('pull_updating', diff.toUpdateLocal.length, diff.toUpdateLocal.length, 'Local metadata updates complete');
      }

      // Pull: Replace local images
      if (diff.toReplaceLocal.length > 0) {
        console.log(`[LocalSync] Replacing ${diff.toReplaceLocal.length} local images`);
        await this.replaceLocalImages(diff.toReplaceLocal, 'pull_replacing');
      }

      // step5: execute sync plan - PUSH operations (local -> remote)
      console.log('[LocalSync] Starting PUSH operations...');

      // Push: Delete remote
      if (diff.toDeleteRemote.length > 0) {
        console.log(`[LocalSync] Deleting ${diff.toDeleteRemote.length} remote images`);
        this.reportProgress('push_deleting', 0, diff.toDeleteRemote.length, `Deleting ${diff.toDeleteRemote.length} remote images...`);
        await this.deleteRemoteImages(diff.toDeleteRemote);
        this.reportProgress('push_deleting', diff.toDeleteRemote.length, diff.toDeleteRemote.length, 'Remote deletions complete');
      }

      // Push: Upload new images
      if (diff.toUpload.length > 0) {
        console.log(`[LocalSync] Uploading ${diff.toUpload.length} new images`);
        await this.uploadImagesToCloud(diff.toUpload, 'push_uploading');
      }

      // Push: Update remote metadata
      if (diff.toUpdateRemote.length > 0) {
        console.log(`[LocalSync] Updating ${diff.toUpdateRemote.length} remote metadata`);
        this.reportProgress('push_updating', 0, diff.toUpdateRemote.length, `Updating ${diff.toUpdateRemote.length} remote metadata...`);
        await this.updateRemoteMetadata(diff.toUpdateRemote);
        this.reportProgress('push_updating', diff.toUpdateRemote.length, diff.toUpdateRemote.length, 'Remote metadata updates complete');
      }

      // Push: Replace remote images
      if (diff.toReplaceRemote.length > 0) {
        console.log(`[LocalSync] Replacing ${diff.toReplaceRemote.length} remote images`);
        await this.replaceRemoteImages(diff.toReplaceRemote, 'push_replacing');
      }

      // step6: Release lock and update sync metadata
      // Lock must be released before updating metadata to get final syncUUID
      this.reportProgress('finalizing', 0, 2, 'Releasing sync lock...');

      let syncUUID: string | null = null;
      let newSeq: number;

      if (lockUuid) {
        try {
          const releaseResult = await releaseLwwLock(lockUuid);
          lockManager.clearLock();

          syncUUID = releaseResult.syncUUID;
          newSeq = releaseResult.syncSequence;

          console.log(`[LocalSync] Lock released. New sync state - Sequence: ${newSeq}, UUID: ${syncUUID}`);
        } catch (error) {
          console.error('[LocalSync] Failed to release lock:', error);
          throw error;
        }
        lockUuid = null; // Clear to prevent double release in finally block
      } else {
        // No lock was acquired (shouldn't happen, but handle gracefully)
        const finalStatus = await getSyncStatus();
        newSeq = finalStatus.currentSequence;
        syncUUID = finalStatus.syncUUID || null;
      }

      this.reportProgress('finalizing', 1, 2, 'Updating sync metadata...');
      await localDatabase.updateSyncMetadata({
        lastSyncSequence: newSeq,
        lastSyncTime: new Date().toISOString(),
        lastSyncUUID: syncUUID,
      });
      this.reportProgress('finalizing', 2, 2, 'Sync metadata updated');

      console.log('[LocalSync] LWW sync completed successfully');
      this.reportProgress('completed', 1, 1, 'Sync completed successfully');
      return {
        success: true,
        message: 'LWW sync completed successfully',
        newSeq,
        diff,
      };

    } catch (error: any) {
      console.error('[LocalSync] Sync failed:', error);

      // Handle specific error cases
      let errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (error?.statusCode === 423) {
        errorMessage = 'Another sync operation is in progress. Please wait and try again.';
      } else if (error?.statusCode === 409) {
        errorMessage = 'Sync conflict detected. Please retry the sync operation.';
      }

      // Report failure
      this.reportProgress('failed', 0, 0, `Sync failed: ${errorMessage}`);

      return {
        success: false,
        message: errorMessage,
      };
    } finally {
      // Always release the lock and clear the sync flag
      if (lockUuid) {
        try {
          console.log(`[LocalSync] Releasing lock: ${lockUuid}`);
          await releaseLwwLock(lockUuid);
          lockManager.clearLock();
          console.log('[LocalSync] Lock released successfully');
        } catch (error) {
          console.error('[LocalSync] Failed to release lock:', error);
          // Clear lock anyway to prevent deadlock on client side
          lockManager.clearLock();
        }
      }

      this.syncInProgress = false;
    }
  }


  /**
   * Upload local images to cloud
   */
  private async uploadImagesToCloud(localImages: LocalImage[], phase: SyncPhase = 'push_uploading'): Promise<void> {
    if (localImages.length === 0) return;

    try {
      console.log(`[LocalSync] Preparing to upload ${localImages.length} images...`);
      this.reportProgress(phase, 0, localImages.length, `Preparing to upload ${localImages.length} images...`);

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

        this.reportProgress(phase, i, localImages.length, `Uploading ${localImage.filename} (${i + 1}/${localImages.length})...`);

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

      this.reportProgress(phase, localImages.length, localImages.length, `Upload completed: ${localImages.length} images`);
      console.log(`[LocalSync] Upload completed: ${localImages.length} images`);
    } catch (error) {
      console.error('[LocalSync] Batch upload failed:', error);
      throw error;
    }
  }

  /**
   * Download images from cloud to local storage
   */
  private async downloadImagesFromCloud(remoteImages: Image[], phase: SyncPhase = 'pull_downloading'): Promise<void> {
    if (remoteImages.length === 0) return;

    try {
      console.log(`[LocalSync] Downloading ${remoteImages.length} images from cloud...`);
      this.reportProgress(phase, 0, remoteImages.length, `Preparing to download ${remoteImages.length} images...`);

      // Get storage base URL for thumbnails (public S3 bucket)
      const STORAGE_BASE_URL = import.meta.env.VITE_STORAGE_URL || 'http://s3.192.168.0.24.nip.io:9999';

      // Request presigned URLs for all images first
      const uuids = remoteImages.map(img => img.uuid);
      const downloadUrls = await requestDownloadUrls(uuids);

      // Create a map for quick lookup
      const urlMap = new Map(downloadUrls.map((d: { uuid: string; downloadUrl: string }) => [d.uuid, d.downloadUrl]));

      for (let i = 0; i < remoteImages.length; i++) {
        const remoteImage = remoteImages[i];
        this.reportProgress(phase, i, remoteImages.length, `Downloading ${remoteImage.filename} (${i + 1}/${remoteImages.length})...`);

        try {
          // Get presigned URL from the map
          const imageUrl = urlMap.get(remoteImage.uuid);

          if (!imageUrl) {
            throw new Error(`No presigned URL found for ${remoteImage.filename}`);
          }

          // Thumbnail URL - always from public S3 storage
          // Thumbnails are always stored as .jpeg regardless of source format
          const thumbnailUrl = `${STORAGE_BASE_URL}/thumbnails/${remoteImage.uuid}.jpeg`;

          // Download image using presigned URL
          const imageResponse = await fetch(imageUrl as string);
          if (!imageResponse.ok) {
            throw new Error(`Failed to download image: ${imageResponse.statusText}`);
          }
          const imageBlob = await imageResponse.blob();

          // Download thumbnail from public storage
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

      this.reportProgress(phase, remoteImages.length, remoteImages.length, `Download completed: ${remoteImages.length} images`);
      console.log(`[LocalSync] Download completed: ${remoteImages.length} images`);
    } catch (error) {
      console.error('[LocalSync] Download failed:', error);
      throw error;
    }
  }

  /**
   * Replace local images with remote versions
   */
  private async replaceLocalImages(remoteImages: Image[], phase: SyncPhase = 'pull_replacing'): Promise<void> {
    if (remoteImages.length === 0) return;

    try {
      this.reportProgress(phase, 0, remoteImages.length, `Preparing to replace ${remoteImages.length} local images...`);

      // First delete the old local versions
      const uuids = remoteImages.map(img => img.uuid);
      await localImageService.deleteImages(uuids);

      // Then download the new versions
      await this.downloadImagesFromCloud(remoteImages, phase);

      this.reportProgress(phase, remoteImages.length, remoteImages.length, `Replaced ${remoteImages.length} local images`);
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
            // Note: updatedAt is not sent - server manages this timestamp
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
  private async replaceRemoteImages(localImages: LocalImage[], phase: SyncPhase = 'push_replacing'): Promise<void> {
    if (localImages.length === 0) return;

    try {
      console.log(`[LocalSync] Preparing to replace ${localImages.length} remote images...`);
      this.reportProgress(phase, 0, localImages.length, `Preparing to replace ${localImages.length} remote images...`);

      // Prepare replacement data
      const replacements = await Promise.all(
        localImages.map(async (localImage, index) => {
          this.reportProgress(phase, index, localImages.length, `Loading ${localImage.filename} (${index + 1}/${localImages.length})...`);

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
      this.reportProgress(phase, localImages.length / 2, localImages.length, `Uploading replacements...`);
      const result = await replaceImages(replacements);

      this.reportProgress(phase, localImages.length, localImages.length, `Replaced ${result.stats.successful} remote images`);
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
