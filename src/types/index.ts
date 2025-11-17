export interface Image {
  id: string
  filename: string
  path: string
  size: number
  format: string
  uploadDate: string
  thumbnailPath?: string
  hash?: string
  createdAt: string
  updatedAt: string
}

export interface UploadStats {
  totalFiles: number
  totalSize: number
  successCount: number
  errorCount: number
  corruptedCount: number
}

export interface ActivityLog {
  id: string
  timestamp: string
  category: 'upload' | 'sync' | 'action' | 'error' | 'warning'
  message: string
}

export interface SyncStatus {
  lastSync: string | null
  syncing: boolean
  pendingChanges: number
  status: 'synced' | 'not-synced' | 'error'
}
