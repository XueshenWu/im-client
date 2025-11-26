/**
 * Local sync service for push/pull operations between local and cloud
 */

import { localImageService } from './localImage.service';
import { localDatabase } from './localDatabase.service';
import { stateDiffService } from './stateDiff.service';
import { getImages, uploadImages, getImageByUuid, getImagesByUuid } from './images.service';
import { getSyncStatus } from './sync.service';
import { LocalImage, StateDiff } from '../types/local';
import { Image } from '../types/api';
import api, { imageService } from './api';

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
      const localImages = await localImageService.getAllImages();
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

      // step4: excute sync plan

      //  delete local
      if (diff.toDeleteLocal.length > 0) {
        await localImageService.deleteImages(diff.toDeleteLocal);
      }

      //  download
      if (diff.toDownload.length > 0) {
        await this.downloadImagesFromCloud(diff.toDownload);
      }

      //  update local
      if (diff.toUpdateLocal.length > 0) {
        await this.updateLocalMetadata(diff.toUpdateLocal);
      }


      // replace local
      if (diff.toReplaceLocal.length > 0) {
        await this.replaceLocalImages(diff.toReplaceLocal);
      }




    } catch (error) {
      console.error('[LocalSync] Sync failed:', error)
      throw error
    } finally {

    }
  }

  /**
   * Push local changes to cloud
   * Returns success status and updated sequence
   */
  // async push(forcePush: boolean = false): Promise<{
  //   success: boolean;
  //   message: string;
  //   newSeq?: number;
  //   diff?: StateDiff;
  // }> {
  //   try {
  //     // Step 1: Check sequence numbers
  //     const status = await this.checkSyncStatus();

  //     if (!forcePush && !status.inSync) {
  //       return {
  //         success: false,
  //         message: `Local is behind server (local: ${status.localSeq}, server: ${status.serverSeq}). Please pull first.`,
  //       };
  //     }

  //     // Step 2: Get local and remote images
  //     const localImages = await localImageService.getAllImages();
  //     const remoteImages = await getImages();

  //     // Step 3: Calculate diff
  //     const diff = stateDiffService.calculateDiff(localImages, remoteImages);

  //     console.log('[LocalSync] Diff calculated:', {
  //       toUpload: diff.toUpload.length,
  //       toUpdate: diff.toUpdate.length,
  //       toDeleteRemote: diff.toDeleteRemote.length,
  //       toReplace: diff.toReplace.length,
  //       localCount: localImages.length,
  //       remoteCount: remoteImages.length,
  //     });

  //     // Step 4: Check if push is safe (no replaces/deletes)
  //     if (!forcePush && stateDiffService.requiresPullFirst(diff)) {
  //       return {
  //         success: false,
  //         message: `Cannot push: diff contains ${diff.toReplace.length} replacements and ${diff.toDeleteRemote.length} deletions. Pull first to resolve conflicts.`,
  //         diff,
  //       };
  //     }

  //     // Step 5: Upload new images
  //     if (diff.toUpload.length > 0) {
  //       console.log(`[LocalSync] Uploading ${diff.toUpload.length} new images...`);
  //       await this.uploadImagesToCloud(diff.toUpload);
  //     }

  //     // Step 6: Update metadata for changed images
  //     if (diff.toUpdate.length > 0) {
  //       console.log(`[LocalSync] Updating ${diff.toUpdate.length} images...`);
  //       await this.updateRemoteMetadata(diff.toUpdate);
  //     }

  //     // Step 7: Delete remote images not in local (only if force push)
  //     if (forcePush && diff.toDeleteRemote.length > 0) {
  //       console.log(`[LocalSync] Force deleting ${diff.toDeleteRemote.length} remote images...`);
  //       // TODO: Implement batch delete remote images
  //     }

  //     // Step 8: Get new server sequence and update local
  //     const newStatus = await getSyncStatus();
  //     await localDatabase.updateSyncMetadata({
  //       lastSyncSequence: newStatus.currentSequence,
  //       lastSyncTime: new Date().toISOString(),
  //     });

  //     return {
  //       success: true,
  //       message: `Successfully pushed ${diff.toUpload.length} new images and ${diff.toUpdate.length} updates`,
  //       newSeq: newStatus.currentSequence,
  //       diff,
  //     };
  //   } catch (error) {
  //     console.error('[LocalSync] Push failed:', error);
  //     return {
  //       success: false,
  //       message: error instanceof Error ? error.message : 'Push failed',
  //     };
  //   }
  // }

  /**
   * Pull remote changes to local
   * Returns affected images that will be replaced/deleted
   */
  // async pull(): Promise<{
  //   success: boolean;
  //   message: string;
  //   affectedImages: LocalImage[];
  //   diff?: StateDiff;
  // }> {
  //   try {
  //     // Step 1: Get local and remote images
  //     const localImages = await localImageService.getAllImages();
  //     const remoteImages = await getImages();

  //     // Step 2: Calculate diff
  //     const diff = stateDiffService.calculateDiff(localImages, remoteImages);

  //     // Step 3: Get affected images (will be replaced or deleted)
  //     const affectedImages = stateDiffService.getAffectedImages(diff);

  //     // Step 4: Download new images from server
  //     if (diff.toDownload.length > 0) {
  //       console.log(`[LocalSync] Downloading ${diff.toDownload.length} new images...`);
  //       await this.downloadImagesFromCloud(diff.toDownload);
  //     }

  //     // Step 5: Replace images with different content
  //     if (diff.toReplace.length > 0) {
  //       console.log(`[LocalSync] Replacing ${diff.toReplace.length} images...`);
  //       await this.replaceLocalImages(diff.toReplace);
  //     }

  //     // Step 6: Update metadata for changed images
  //     if (diff.toUpdate.length > 0) {
  //       console.log(`[LocalSync] Updating ${diff.toUpdate.length} images...`);
  //       await this.updateLocalMetadata(diff.toUpdate);
  //     }

  //     // Step 7: Delete local images not in remote
  //     if (diff.toDeleteLocal.length > 0) {
  //       console.log(`[LocalSync] Deleting ${diff.toDeleteLocal.length} local images...`);
  //       await localImageService.deleteImages(diff.toDeleteLocal);
  //     }

  //     // Step 8: Update local sequence
  //     const newStatus = await getSyncStatus();
  //     await localDatabase.updateSyncMetadata({
  //       lastSyncSequence: newStatus.currentSequence,
  //       lastSyncTime: new Date().toISOString(),
  //     });

  //     const summary = stateDiffService.getDiffSummary(diff);
  //     return {
  //       success: true,
  //       message: `Successfully pulled: ${summary.toDownload} new, ${summary.toReplace} replaced, ${summary.toUpdate} updated, ${summary.toDeleteLocal} deleted`,
  //       affectedImages,
  //       diff,
  //     };
  //   } catch (error) {
  //     console.error('[LocalSync] Pull failed:', error);
  //     return {
  //       success: false,
  //       message: error instanceof Error ? error.message : 'Pull failed',
  //       affectedImages: [],
  //     };
  //   }
  // }

  /**
   * Auto-sync: try push first, if fails then pull and push
   */
  // async autoSync(): Promise<{ success: boolean; message: string }> {
  //   try {
  //     // Try push first
  //     const pushResult = await this.push(false);

  //     if (pushResult.success) {
  //       return pushResult;
  //     }

  //     // Push failed, try pull then push
  //     console.log('[LocalSync] Push failed, pulling first...');
  //     const pullResult = await this.pull();

  //     if (!pullResult.success) {
  //       return {
  //         success: false,
  //         message: `Auto-sync failed: ${pullResult.message}`,
  //       };
  //     }

  //     // Try push again after pull
  //     const retryPushResult = await this.push(false);
  //     return {
  //       success: retryPushResult.success,
  //       message: `Auto-sync: ${pullResult.message}, then ${retryPushResult.message}`,
  //     };
  //   } catch (error) {
  //     console.error('[LocalSync] Auto-sync failed:', error);
  //     return {
  //       success: false,
  //       message: error instanceof Error ? error.message : 'Auto-sync failed',
  //     };
  //   }
  // }

  /**
   * Upload local images to cloud
   */
  private async uploadImagesToCloud(localImages: LocalImage[]): Promise<void> {
    if (localImages.length === 0) return;

    try {
      console.log(`[LocalSync] Preparing to upload ${localImages.length} images with UUIDs...`);

      // Read all files in parallel
      const fileReadPromises = localImages.map(async (localImage) => {
        const buffer = await window.electronAPI?.readLocalFile(localImage.filePath);
        if (!buffer) {
          console.error(`[LocalSync] Failed to read file: ${localImage.filePath}`);
          return null;
        }
        return {
          file: new File([buffer], localImage.filename, {
            type: `image/${localImage.format}`,
          }),
          uuid: localImage.uuid,
          filename: localImage.filename,
        };
      });

      const fileData = (await Promise.all(fileReadPromises)).filter((f) => f !== null);

      if (fileData.length === 0) {
        console.error('[LocalSync] No files could be read');
        return;
      }

      const files = fileData.map((f) => f.file);
      const uuids = fileData.map((f) => f.uuid);

      console.log(`[LocalSync] Uploading ${files.length} files with UUIDs:`, uuids);

      // Upload all files in a single batch with their UUIDs
      const response = await uploadImages(files, uuids);

      console.log(`[LocalSync] Batch upload response:`, {
        success: response.success,
        message: response.message,
        uploadedCount: response.data?.length,
      });

      // Verify UUIDs were preserved
      if (response.success && response.data) {
        response.data.forEach((serverImage, index) => {
          const localUuid = uuids[index];
          if (serverImage.uuid === localUuid) {
            console.log(`[LocalSync] ✓ UUID preserved: ${fileData[index].filename} (${localUuid})`);
          } else {
            console.warn(
              `[LocalSync] ⚠ UUID mismatch: ${fileData[index].filename} - local=${localUuid}, server=${serverImage.uuid}`
            );
          }
        });
      }
    } catch (error) {
      console.error('[LocalSync] Batch upload failed:', error);
      throw error;
    }
  }

  /**
   * Download images from cloud to local storage
   */
  private async downloadImagesFromCloud(remoteImages: Image[]): Promise<void> {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';


    for (const remoteImage of remoteImages) {
      try {

        // Download image
        const imageUrl = `${API_URL}${remoteImage.filePath}`;
        const imageResponse = await fetch(imageUrl);
        const imageBlob = await imageResponse.blob();

        // Downlaod thumbnail
        const thumbnailUrl = `${API_URL}${remoteImage.thumbnailPath}`;
        const thumbnailResponse = await fetch(thumbnailUrl);
        const thumbnailBlob = await thumbnailResponse.blob();



        // Save to local storage via Electron
        const imageBuffer = await imageBlob.arrayBuffer();
        const thumbnailBuffer = await thumbnailBlob.arrayBuffer();

        // save files to AppData and get local path

        const localImagePath = await window.electronAPI?.saveImageBuffer(remoteImage.filename, imageBuffer);
        const localThumbnailPath = await window.electronAPI?.saveThumbnailBuffer(remoteImage.filename, thumbnailBuffer);

        if (!localImagePath || !localThumbnailPath) {
          console.error(`Failed to save files for ${remoteImage.filename}`);
          continue
        }

        await localImageService.addImage({
          uuid: remoteImage.uuid,
          filename: remoteImage.filename,
          format: remoteImage.format,
          filePath: localImagePath,
          thumbnailPath: localThumbnailPath,
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
          originalName: remoteImage.originalName,
        })
        console.log(`[LocalSync] Downloaded: ${remoteImage.filename}`);
      } catch (error) {
        console.error(`[LocalSync] Failed to download ${remoteImage.filename}:`, error);
      }

    }
  }

  /**
   * Replace local images with remote versions
   */


  // Working on syncLWW, now refactor replaceLocalImages
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
          deletedAt: image.deletedAt,
          exifData: image.exifData,
          originalName: image.originalName,
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
