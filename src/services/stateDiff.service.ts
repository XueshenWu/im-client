/**
 * State diff service for comparing local and remote image states
 */

import { LocalImage, StateDiff } from '../types/local';
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
            if (this.hasMetadataChanges(local, remote)) {
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
            if (this.hasMetadataChanges(local, remote)) {
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

  private hasMetadataChanges(local: LocalImage, remote: Image): boolean {
    // Compare simple metadata fields
    if (local.filename !== remote.filename) return true;
    if (local.fileSize !== remote.fileSize) return true;
    if (local.width !== remote.width) return true;
    if (local.height !== remote.height) return true;
    if (local.isCorrupted !== remote.isCorrupted) return true;
    if (local.mimeType !== remote.mimeType) return true;

    // Compare TIFF-specific fields
    if (local.pageCount !== remote.pageCount) return true;

    // Compare tiffDimensions (array of objects)
    if (JSON.stringify(local.tiffDimensions) !== JSON.stringify(remote.tiffDimensions)) {
      return true;
    }

    // Compare EXIF data (complex object)
    if (JSON.stringify(local.exifData) !== JSON.stringify(remote.exifData)) {
      return true;
    }

    return false;
  }

 

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

 
}

// Singleton instance
export const stateDiffService = new StateDiffService();
