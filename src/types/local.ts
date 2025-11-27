// Local storage types for local mode

import { Image } from './api';

/**
 * Local image stored in SQLite database
 * Paths are calculated on-the-fly using UUID + format
 */
export interface LocalImage extends Omit<Image, 'id'> {
  id?: number; // SQLite ROWID, optional for new images
}



/**
 * State difference between local and remote
 */
export interface StateDiff {
  // --- REMOTE ACTIONS (PUSH: Local -> Remote) ---
  toUpload: LocalImage[];           // New file locally -> Upload binary + meta
  toReplaceRemote: LocalImage[];    // Binary changed locally -> Upload binary + meta
  toUpdateRemote: LocalImage[];     // Only metadata changed locally -> Update DB
  toDeleteRemote: string[];         // Deleted locally -> Delete on Server

  // --- LOCAL ACTIONS (PULL: Remote -> Local) ---
  toDownload: Image[];              // New file remotely -> Download binary + meta
  toReplaceLocal: Image[];          // Binary changed remotely -> Download binary + meta
  toUpdateLocal: Image[];           // Only metadata changed remotely -> Update DB
  toDeleteLocal: string[];          // Deleted remotely -> Delete on Disk
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
