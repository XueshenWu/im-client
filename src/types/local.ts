// Local storage types for local mode

import { Image } from './api';

/**
 * Local image stored in SQLite database
 * Mirrors server Image type but with local file paths
 */
export interface LocalImage extends Omit<Image, 'id'> {
  id?: number; // SQLite ROWID, optional for new images
  filePath: string; // Local AppData path
  thumbnailPath: string; // Local thumbnail path
}



/**
 * State difference between local and remote
 */
export interface StateDiff {
  toUpload: LocalImage[]; // Images only in local
  toDownload: Image[]; // Images only in remote
  toDeleteLocal: string[]; // UUIDs to remove from local
  toDeleteRemote: string[]; // UUIDs to remove from remote
  toUpdate: UpdatePair[]; // Different metadata
  toReplace: ReplacePair[]; // Different content (hash mismatch)
}

export interface UpdatePair {
  localImage: LocalImage;
  remoteImage: Image;
  changes: Partial<Image>;
}

export interface ReplacePair {
  localImage: LocalImage;
  remoteImage: Image;
}

/**
 * Sync metadata stored in database
 */
export interface SyncMetadata {
  lastSyncSequence: number;
  lastSyncTime: string | null;
}

/**
 * Export options for conflict resolution
 */
export interface ExportOptions {
  exportDeleted: boolean;
  exportReplaced: boolean;
  destination: string;
}

/**
 * Source mode for application
 */
export type SourceMode = 'cloud' | 'local';

/**
 * Sync policy settings
 */
export interface SyncPolicy {
  mode: 'manual' | 'auto';
  intervalSeconds: number; // Used if mode is 'auto'
}

/**
 * Application settings
 */
export interface AppSettings {
  sourceMode: SourceMode;
  syncPolicy: SyncPolicy;
  exportOnConflict: boolean; // Show export dialog on pull conflicts
}
