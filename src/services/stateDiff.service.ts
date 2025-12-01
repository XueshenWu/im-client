import { LocalImage, StateDiff } from '../types/local';
import { Image } from '../types/api';

class StateDiffService {
  // Calculate the difference between local and remote states
  calculateDiff(localImages: LocalImage[], remoteImages: Image[]): StateDiff {
    const localByUuid = new Map(localImages.map((img) => [img.uuid, img]));
    const remoteByUuid = new Map(remoteImages.map((img) => [img.uuid, img]));
    const allUuids = new Set([...localByUuid.keys(), ...remoteByUuid.keys()]);

    const diff: StateDiff = {
      toUpload: [], toReplaceRemote: [], toUpdateRemote: [], toDeleteRemote: [],
      toDownload: [], toReplaceLocal: [], toUpdateLocal: [], toDeleteLocal: []
    };

    // 3. Iterate Union
    for (const uuid of allUuids) {
      const local = localByUuid.get(uuid);
      const remote = remoteByUuid.get(uuid);

      // Local Only
      if (local && !remote) {
        if (local.deletedAt) continue; // It's dead, ignore.
        diff.toUpload.push(local);    
      }

      // Remote Only
      else if (!local && remote) {
        if (remote.deletedAt) continue; // It's dead, ignore.
        diff.toDownload.push(remote);   
      }

      // Both Exist
      else if (local && remote) {
        const localTime = new Date(local.updatedAt).getTime();
        const remoteTime = new Date(remote.updatedAt).getTime();

        // Local is Newer (Push Changes)
        if (localTime > remoteTime) {
          if (local.deletedAt) {
            // Local was deleted recently -> Propagate delete to remote
            diff.toDeleteRemote.push(uuid);
          } else if (remote.deletedAt) {
            // Remote was deleted but local is alive and newer -> Re-upload to resurrect
            diff.toUpload.push(local);
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

        // Remote is Newer (Pull Changes)
        else if (remoteTime > localTime) {
          if (remote.deletedAt) {
            // Remote was deleted recently -> Propagate delete to local
            diff.toDeleteLocal.push(uuid);
          } else if (local.deletedAt) {
            // Local was deleted but remote is alive and newer -> Re-download to resurrect
            diff.toDownload.push(remote);
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

        // Timestamps Equal (Tie-Breaker)
        else {
          if (local.deletedAt && remote.deletedAt) {
            // Both deleted at same time, in sync
            continue;
          }
          // If one is deleted but other isn't, prefer server (remote)
          else if (remote.deletedAt && !local.deletedAt) {
            diff.toDeleteLocal.push(uuid);
          } else if (local.deletedAt && !remote.deletedAt) {
            diff.toDeleteRemote.push(uuid);
          }
          // Both are alive, check content
          else if (local.hash !== remote.hash) {
            // Content differs but timestamps match - use server as source of truth
            console.warn(`[StateDiff] Timestamp tie for ${uuid}, hash mismatch. Preferring server version.`);
            diff.toReplaceLocal.push(remote);
          } else if (this.hasMetadataChanges(local, remote)) {
            // Content matches, but metadata differs - use server metadata
            diff.toUpdateLocal.push(remote);
          }
          // If both hash and metadata match, do nothing
        }
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



  // Get summary of diff for display
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


export const stateDiffService = new StateDiffService();
