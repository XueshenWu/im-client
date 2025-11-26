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
    // 1. Indexing (Same as before)
    const localByUuid = new Map(localImages.map((img) => [img.uuid, img]));
    const remoteByUuid = new Map(remoteImages.map((img) => [img.uuid, img]));
    const allUuids = new Set([...localByUuid.keys(), ...remoteByUuid.keys()]);

    // 2. Initialize Buckets
    const diff: StateDiff = {
      toUpload: [], toReplaceRemote: [], toUpdateRemote: [], toDeleteRemote: [],
      toDownload: [], toReplaceLocal: [], toUpdateLocal: [], toDeleteLocal: []
    };

    // 3. Iterate Union
    for (const uuid of allUuids) {
      const local = localByUuid.get(uuid);
      const remote = remoteByUuid.get(uuid);

      // --- CASE 1: Local Only (New or Zombie?) ---
      if (local && !remote) {
        if (local.deletedAt) continue; // It's dead, ignore.
        diff.toUpload.push(local);     // It's new, upload it.
      }

      // --- CASE 2: Remote Only (New or Zombie?) ---
      else if (!local && remote) {
        if (remote.deletedAt) continue; // It's dead, ignore.
        diff.toDownload.push(remote);   // It's new, download it.
      }

      // --- CASE 3: Both Exist (Conflict!) ---
      else if (local && remote) {
        const localTime = new Date(local.updatedAt).getTime();
        const remoteTime = new Date(remote.updatedAt).getTime();

        // >>> SUB-CASE A: Local is Newer (Push Changes) <<<
        if (localTime > remoteTime) {
          if (local.deletedAt) {
            // Local was deleted recently -> Propagate delete
            diff.toDeleteRemote.push(uuid);
          } else if (local.hash !== remote.hash) {
            // Binary content changed -> Re-upload file
            diff.toReplaceRemote.push(local);
          } else {
            // Only metadata might have changed
            const changes = this.findMetadataChanges(local, remote);
            if (Object.keys(changes).length > 0) {
              diff.toUpdateRemote.push(local);
            }
          }
        }

        // >>> SUB-CASE B: Remote is Newer (Pull Changes) <<<
        else if (remoteTime > localTime) {
          if (remote.deletedAt) {
            // Remote was deleted recently -> Propagate delete
            diff.toDeleteLocal.push(uuid);
          } else if (local.hash !== remote.hash) {
            // Binary content changed -> Re-download file
            diff.toReplaceLocal.push(remote);
          } else {
            // Only metadata might have changed
            const changes = this.findMetadataChanges(local, remote);
            if (Object.keys(changes).length > 0) {
              diff.toUpdateLocal.push(remote);
            }
          }
        }

        // >>> SUB-CASE C: Synced (Timestamps Equal) <<<
        // Do nothing.
      }
    }

    return diff;
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


    // Compare JSON fields (tags, exifData)

    if (JSON.stringify(local.exifData) !== JSON.stringify(remote.exifData)) {
      changes.exifData = remote.exifData;
    }

    return changes;
  }

  /**
   * Check if diff contains operations that require pull first
   * Returns true if diff has replacements or deletions
   */
  // requiresPullFirst(diff: StateDiff): boolean {
  //   return diff.toReplace.length > 0 || diff.toDeleteRemote.length > 0;
  // }

  /**
   * Check if diff is safe for fast-forward push
   * Only additions and metadata updates are safe
   */
  // canFastForwardPush(diff: StateDiff): boolean {
  //   return !this.requiresPullFirst(diff);
  // }

  /**
   * Get summary of diff for display
   */
  getDiffSummary(diff: StateDiff): {
    toUpload: number;
    toDownload: number;
    toDeleteLocal: number;
    toDeleteRemote: number;
    toUpdateRemote: number;
    toUpdateLocal: number;
    toReplaceRemote: number;
    toReplaceLocal: number;
    totalChanges: number;
  } {
    const summary = {
      toUpload: diff.toUpload.length,
      toDownload: diff.toDownload.length,
      toDeleteLocal: diff.toDeleteLocal.length,
      toDeleteRemote: diff.toDeleteRemote.length,
      toUpdateRemote: diff.toUpdateRemote.length,
      toUpdateLocal: diff.toUpdateLocal.length,
      toReplaceRemote: diff.toReplaceRemote.length,
      toReplaceLocal: diff.toReplaceLocal.length,
      totalChanges: 0,
    };

    summary.totalChanges =
      summary.toUpload +
      summary.toDownload +
      summary.toDeleteLocal +
      summary.toDeleteRemote +
      summary.toUpdateRemote +
      summary.toUpdateLocal +
      summary.toReplaceRemote +
      summary.toReplaceLocal;

    return summary;
  }

  /**
   * Get images that will be affected by pull (replaced or deleted)
   */
  // getAffectedImages(diff: StateDiff): LocalImage[] {
  //   const affected: LocalImage[] = [];

  //   // Images that will be replaced
  //   for (const pair of diff.toReplace) {
  //     affected.push(pair.localImage);
  //   }

  //   // Images that will be deleted
  //   // (Note: toDeleteLocal contains UUIDs, need to get full images elsewhere)

  //   return affected;
  // }
}

// Singleton instance
export const stateDiffService = new StateDiffService();
