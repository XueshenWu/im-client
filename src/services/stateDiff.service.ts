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

    // Categorize images based on presence in local vs remote
    // Note: An image missing from one side could mean either:
    // 1. It's new on the other side (needs upload/download)
    // 2. It was deleted from that side (needs deletion on the other side)
    // We categorize for BOTH push and pull operations:

    // Images in LOCAL but not in REMOTE:
    for (const localImage of localImages) {
      if (!remoteByUuid.has(localImage.uuid)) {
        // For PUSH: assume it's new locally → upload to remote
        toUpload.push(localImage);
        // For PULL: assume it was deleted from remote → delete from local
        toDeleteLocal.push(localImage.uuid);
      }
    }

    // Images in REMOTE but not in LOCAL:
    for (const remoteImage of remoteImages) {
      if (!localByUuid.has(remoteImage.uuid)) {
        // For PULL: assume it's new remotely → download to local
        toDownload.push(remoteImage);
        // For PUSH: assume it was deleted locally → delete from remote
        toDeleteRemote.push(remoteImage.uuid);
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
