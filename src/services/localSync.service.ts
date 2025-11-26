/**
 * Local sync service for push/pull operations between local and cloud
 */

import { localImageService } from './localImage.service';
import { localDatabase } from './localDatabase.service';
import { stateDiffService } from './stateDiff.service';
import { getImages, uploadImages } from './images.service';
import { getSyncStatus } from './sync.service';
import { LocalImage, StateDiff } from '../types/local';
import { Image } from '../types/api';
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

  /**
   * Push local changes to cloud
   * Returns success status and updated sequence
   */
  async push(forcePush: boolean = false): Promise<{
    success: boolean;
    message: string;
    newSeq?: number;
    diff?: StateDiff;
  }> {
    try {
      // Step 1: Check sequence numbers
      const status = await this.checkSyncStatus();

      if (!forcePush && !status.inSync) {
        return {
          success: false,
          message: `Local is behind server (local: ${status.localSeq}, server: ${status.serverSeq}). Please pull first.`,
        };
      }

      // Step 2: Get local and remote images
      const localImages = await localImageService.getAllImages();
      const remoteImages = await getImages();

      // Step 3: Calculate diff
      const diff = stateDiffService.calculateDiff(localImages, remoteImages);

      // Step 4: Check if push is safe (no replaces/deletes)
      if (!forcePush && stateDiffService.requiresPullFirst(diff)) {
        return {
          success: false,
          message: `Cannot push: diff contains ${diff.toReplace.length} replacements and ${diff.toDeleteRemote.length} deletions. Pull first to resolve conflicts.`,
          diff,
        };
      }

      // Step 5: Upload new images
      if (diff.toUpload.length > 0) {
        console.log(`[LocalSync] Uploading ${diff.toUpload.length} new images...`);
        await this.uploadImagesToCloud(diff.toUpload);
      }

      // Step 6: Update metadata for changed images
      if (diff.toUpdate.length > 0) {
        console.log(`[LocalSync] Updating ${diff.toUpdate.length} images...`);
        await this.updateRemoteMetadata(diff.toUpdate);
      }

      // Step 7: Delete remote images not in local (only if force push)
      if (forcePush && diff.toDeleteRemote.length > 0) {
        console.log(`[LocalSync] Force deleting ${diff.toDeleteRemote.length} remote images...`);
        // TODO: Implement batch delete remote images
      }

      // Step 8: Get new server sequence and update local
      const newStatus = await getSyncStatus();
      await localDatabase.updateSyncMetadata({
        lastSyncSequence: newStatus.currentSequence,
        lastSyncTime: new Date().toISOString(),
      });

      return {
        success: true,
        message: `Successfully pushed ${diff.toUpload.length} new images and ${diff.toUpdate.length} updates`,
        newSeq: newStatus.currentSequence,
        diff,
      };
    } catch (error) {
      console.error('[LocalSync] Push failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Push failed',
      };
    }
  }

  /**
   * Pull remote changes to local
   * Returns affected images that will be replaced/deleted
   */
  async pull(): Promise<{
    success: boolean;
    message: string;
    affectedImages: LocalImage[];
    diff?: StateDiff;
  }> {
    try {
      // Step 1: Get local and remote images
      const localImages = await localImageService.getAllImages();
      const remoteImages = await getImages();

      // Step 2: Calculate diff
      const diff = stateDiffService.calculateDiff(localImages, remoteImages);

      // Step 3: Get affected images (will be replaced or deleted)
      const affectedImages = stateDiffService.getAffectedImages(diff);

      // Step 4: Download new images from server
      if (diff.toDownload.length > 0) {
        console.log(`[LocalSync] Downloading ${diff.toDownload.length} new images...`);
        await this.downloadImagesFromCloud(diff.toDownload);
      }

      // Step 5: Replace images with different content
      if (diff.toReplace.length > 0) {
        console.log(`[LocalSync] Replacing ${diff.toReplace.length} images...`);
        await this.replaceLocalImages(diff.toReplace);
      }

      // Step 6: Update metadata for changed images
      if (diff.toUpdate.length > 0) {
        console.log(`[LocalSync] Updating ${diff.toUpdate.length} images...`);
        await this.updateLocalMetadata(diff.toUpdate);
      }

      // Step 7: Delete local images not in remote
      if (diff.toDeleteLocal.length > 0) {
        console.log(`[LocalSync] Deleting ${diff.toDeleteLocal.length} local images...`);
        await localImageService.deleteImages(diff.toDeleteLocal);
      }

      // Step 8: Update local sequence
      const newStatus = await getSyncStatus();
      await localDatabase.updateSyncMetadata({
        lastSyncSequence: newStatus.currentSequence,
        lastSyncTime: new Date().toISOString(),
      });

      const summary = stateDiffService.getDiffSummary(diff);
      return {
        success: true,
        message: `Successfully pulled: ${summary.toDownload} new, ${summary.toReplace} replaced, ${summary.toUpdate} updated, ${summary.toDeleteLocal} deleted`,
        affectedImages,
        diff,
      };
    } catch (error) {
      console.error('[LocalSync] Pull failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Pull failed',
        affectedImages: [],
      };
    }
  }

  /**
   * Auto-sync: try push first, if fails then pull and push
   */
  async autoSync(): Promise<{ success: boolean; message: string }> {
    try {
      // Try push first
      const pushResult = await this.push(false);

      if (pushResult.success) {
        return pushResult;
      }

      // Push failed, try pull then push
      console.log('[LocalSync] Push failed, pulling first...');
      const pullResult = await this.pull();

      if (!pullResult.success) {
        return {
          success: false,
          message: `Auto-sync failed: ${pullResult.message}`,
        };
      }

      // Try push again after pull
      const retryPushResult = await this.push(false);
      return {
        success: retryPushResult.success,
        message: `Auto-sync: ${pullResult.message}, then ${retryPushResult.message}`,
      };
    } catch (error) {
      console.error('[LocalSync] Auto-sync failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Auto-sync failed',
      };
    }
  }

  /**
   * Upload local images to cloud
   */
  private async uploadImagesToCloud(localImages: LocalImage[]): Promise<void> {
    const uploadPromises = localImages.map(async (localImage) => {
      try {
        // Read file from local storage
        const buffer = await window.electronAPI?.readLocalFile(localImage.filePath);
        if (!buffer) {
          console.error(`Failed to read file: ${localImage.filePath}`);
          return;
        }

        // Convert buffer to File object
        const file = new File([buffer], localImage.filename, {
          type: `image/${localImage.format}`,
        });

        // Upload to server (direct upload, no chunking in local mode)
        await uploadImages([file]);
        console.log(`[LocalSync] Uploaded: ${localImage.filename}`);
      } catch (error) {
        console.error(`[LocalSync] Failed to upload ${localImage.filename}:`, error);
      }
    });

    await Promise.all(uploadPromises);
  }

  /**
   * Download images from cloud to local storage
   */
  private async downloadImagesFromCloud(remoteImages: Image[]): Promise<void> {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

    const downloadPromises = remoteImages.map(async (remoteImage) => {
      try {
        // Download image file
        const imageUrl = `${API_URL}${remoteImage.filePath}`;
        const imageResponse = await fetch(imageUrl);
        const imageBlob = await imageResponse.blob();

        // Download thumbnail
        const thumbnailUrl = `${API_URL}${remoteImage.thumbnailPath}`;
        const thumbnailResponse = await fetch(thumbnailUrl);
        const thumbnailBlob = await thumbnailResponse.blob();

        // Save to local storage via Electron
        const imageBuffer = await imageBlob.arrayBuffer();
        const thumbnailBuffer = await thumbnailBlob.arrayBuffer();

        // Save files to AppData and get local paths
        const localImagePath = await window.electronAPI?.saveImageBuffer(remoteImage.filename, imageBuffer);
        const localThumbnailPath = await window.electronAPI?.saveThumbnailBuffer(remoteImage.filename, thumbnailBuffer);

        if (!localImagePath || !localThumbnailPath) {
          console.error(`Failed to save files for ${remoteImage.filename}`);
          return;
        }

        // Convert to LocalImage and insert
        const localImage = localImageService.serverImageToLocal(
          remoteImage,
          localImagePath,
          localThumbnailPath
        );

        await localImageService.addImage(localImage);
        console.log(`[LocalSync] Downloaded: ${remoteImage.filename}`);
      } catch (error) {
        console.error(`[LocalSync] Failed to download ${remoteImage.filename}:`, error);
      }
    });

    await Promise.all(downloadPromises);
  }

  /**
   * Replace local images with remote versions
   */
  private async replaceLocalImages(replacePairs: Array<{ localImage: LocalImage; remoteImage: Image }>): Promise<void> {
    const replacePromises = replacePairs.map(async (pair) => {
      try {
        // Download new version from cloud
        await this.downloadImagesFromCloud([pair.remoteImage]);
        console.log(`[LocalSync] Replaced: ${pair.localImage.filename}`);
      } catch (error) {
        console.error(`[LocalSync] Failed to replace ${pair.localImage.filename}:`, error);
      }
    });

    await Promise.all(replacePromises);
  }

  /**
   * Update local metadata from remote
   */
  private async updateLocalMetadata(updatePairs: Array<{ localImage: LocalImage; remoteImage: Image; changes: Partial<Image> }>): Promise<void> {
    const updatePromises = updatePairs.map(async (pair) => {
      try {
        await localImageService.updateImage(pair.localImage.uuid, pair.changes);
        console.log(`[LocalSync] Updated metadata: ${pair.localImage.filename}`);
      } catch (error) {
        console.error(`[LocalSync] Failed to update ${pair.localImage.filename}:`, error);
      }
    });

    await Promise.all(updatePromises);
  }

  /**
   * Update remote metadata from local
   */
  private async updateRemoteMetadata(updatePairs: Array<{ localImage: LocalImage; remoteImage: Image; changes: Partial<Image> }>): Promise<void> {
    const updatePromises = updatePairs.map(async (pair) => {
      try {
        // Use the existing update API
        await api.put(`/api/images/uuid/${pair.localImage.uuid}`, pair.changes);
        console.log(`[LocalSync] Updated remote metadata: ${pair.localImage.filename}`);
      } catch (error: any) {
        // Handle 404 errors specifically - image doesn't exist on server
        if (error?.statusCode === 404 || error?.response?.status === 404) {
          console.warn(`[LocalSync] Image ${pair.localImage.filename} (UUID: ${pair.localImage.uuid}) not found on server. It may have been created locally and needs to be uploaded instead.`);
        } else {
          console.error(`[LocalSync] Failed to update remote ${pair.localImage.filename}:`, error);
        }
      }
    });

    await Promise.all(updatePromises);
  }
}

// Singleton instance
export const localSyncService = new LocalSyncService();
