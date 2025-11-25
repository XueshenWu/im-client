/**
 * State diff service for comparing local and remote image states
 */

import { LocalImage, StateDiff, UpdatePair, ReplacePair } from '../types/local';
import { Image } from '../types/api';

class StateDiffService {
  /**
   * Calculate the difference between local and remote states
   */
  calculateDiff(localImages: LocalImage[], remoteImages: Image[]): StateDiff {
    const localByUuid = new Map(localImages.map((img) => [img.uuid, img]));
    const remoteByUuid = new Map(remoteImages.map((img) => [img.uuid, img]));

    const toUpload: LocalImage[] = [];
    const toDownload: Image[] = [];
    const toDeleteLocal: string[] = [];
    const toDeleteRemote: string[] = [];
    const toUpdate: UpdatePair[] = [];
    const toReplace: ReplacePair[] = [];

    // Find images to upload (in local but not in remote)
    for (const localImage of localImages) {
      if (!remoteByUuid.has(localImage.uuid)) {
        toUpload.push(localImage);
      }
    }

    // Find images to download (in remote but not in local)
    for (const remoteImage of remoteImages) {
      if (!localByUuid.has(remoteImage.uuid)) {
        toDownload.push(remoteImage);
      }
    }

    // Compare images that exist in both local and remote
    for (const localImage of localImages) {
      const remoteImage = remoteByUuid.get(localImage.uuid);
      if (!remoteImage) continue; // Already handled in toUpload

      // Check if content changed (hash mismatch)
      if (localImage.hash && remoteImage.hash && localImage.hash !== remoteImage.hash) {
        toReplace.push({ localImage, remoteImage });
        continue;
      }

      // Check if metadata changed
      const changes = this.findMetadataChanges(localImage, remoteImage);
      if (Object.keys(changes).length > 0) {
        toUpdate.push({ localImage, remoteImage, changes });
      }
    }

    return {
      toUpload,
      toDownload,
      toDeleteLocal,
      toDeleteRemote,
      toUpdate,
      toReplace,
    };
  }

  /**
   * Find metadata differences between local and remote images
   */
  private findMetadataChanges(local: LocalImage, remote: Image): Partial<Image> {
    const changes: Partial<Image> = {};

    // Compare metadata fields
    if (local.filename !== remote.filename) {
      changes.filename = remote.filename;
    }
    if (local.originalName !== remote.originalName) {
      changes.originalName = remote.originalName;
    }
    if (local.fileSize !== remote.fileSize) {
      changes.fileSize = remote.fileSize;
    }
    if (local.width !== remote.width) {
      changes.width = remote.width;
    }
    if (local.height !== remote.height) {
      changes.height = remote.height;
    }
    if (local.collectionId !== remote.collectionId) {
      changes.collectionId = remote.collectionId;
    }

    // Compare JSON fields (tags, exifData)
    if (JSON.stringify(local.tags) !== JSON.stringify(remote.tags)) {
      changes.tags = remote.tags;
    }
    if (JSON.stringify(local.exifData) !== JSON.stringify(remote.exifData)) {
      changes.exifData = remote.exifData;
    }

    return changes;
  }

  /**
   * Check if diff contains operations that require pull first
   * Returns true if diff has replacements or deletions
   */
  requiresPullFirst(diff: StateDiff): boolean {
    return diff.toReplace.length > 0 || diff.toDeleteRemote.length > 0;
  }

  /**
   * Check if diff is safe for fast-forward push
   * Only additions and metadata updates are safe
   */
  canFastForwardPush(diff: StateDiff): boolean {
    return !this.requiresPullFirst(diff);
  }

  /**
   * Get summary of diff for display
   */
  getDiffSummary(diff: StateDiff): {
    toUpload: number;
    toDownload: number;
    toDeleteLocal: number;
    toDeleteRemote: number;
    toUpdate: number;
    toReplace: number;
    totalChanges: number;
  } {
    const summary = {
      toUpload: diff.toUpload.length,
      toDownload: diff.toDownload.length,
      toDeleteLocal: diff.toDeleteLocal.length,
      toDeleteRemote: diff.toDeleteRemote.length,
      toUpdate: diff.toUpdate.length,
      toReplace: diff.toReplace.length,
      totalChanges: 0,
    };

    summary.totalChanges =
      summary.toUpload +
      summary.toDownload +
      summary.toDeleteLocal +
      summary.toDeleteRemote +
      summary.toUpdate +
      summary.toReplace;

    return summary;
  }

  /**
   * Get images that will be affected by pull (replaced or deleted)
   */
  getAffectedImages(diff: StateDiff): LocalImage[] {
    const affected: LocalImage[] = [];

    // Images that will be replaced
    for (const pair of diff.toReplace) {
      affected.push(pair.localImage);
    }

    // Images that will be deleted
    // (Note: toDeleteLocal contains UUIDs, need to get full images elsewhere)

    return affected;
  }
}

// Singleton instance
export const stateDiffService = new StateDiffService();
