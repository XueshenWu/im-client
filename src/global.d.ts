/// <reference types="vite/client" />

// CSS modules
declare module '*.css' {
  const content: Record<string, string>
  export default content
}

// Local image file type

// Electron API interface
interface ElectronAPI {
  // Window controls
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void
  setWindowTitle: (title: string) => void
  getFilePath: (file: File) => string
  expandPath: (path: string, recursive?: boolean) => Promise<string[]>
  readLocalFile: (path: string) => Promise<ArrayBuffer | null>
  writeTempFile: (fileName: string, buffer: ArrayBuffer) => Promise<string | null>
  saveImageBuffer: (fileName: string, buffer: ArrayBuffer) => Promise<string | null>
  saveThumbnailBuffer: (fileName: string, buffer: ArrayBuffer) => Promise<string | null>
  openDialog: () => Promise<string[]>
  selectDirectory: () => Promise<string | null>
  saveFilesToLocal: (filePaths: string[]) => Promise<{
    success: boolean
    savedFiles?: string[]
    directory?: string
    error?: string
  }>
  saveThumbnailsToLocal: (filePaths: string[]) => Promise<{
    success: boolean
    savedFiles?: string[]
    directory?: string
    error?: string
  }>

  getRoamPath: () => Promise<string>
  getLocalImages: (options?: { limit?: number; offset?: number }) => Promise<{
    success: boolean
    data: LocalImageFile[]
    total: number
    hasMore: boolean
    error?: string
  }>
  getDeviceId: () => Promise<string>
  exportImages: (
    images: Array<{ uuid: string; filePath: string; filename: string }>,
    destination: string
  ) => Promise<{
    success: boolean
    results?: Array<{ uuid: string; success: boolean; path?: string; error?: string }>
    error?: string
  }>

  // Database operations
  db: {
    initialize: () => Promise<{ success: boolean; error?: string }>
    getAllImages: () => Promise<any[]>
    getImageByUuid: (uuid: string) => Promise<any | undefined>
    getPaginatedImages: (page: number, pageSize: number, sortBy?: string, sortOrder?: string) => Promise<{ images: any[]; total: number }>
    insertImage: (image: any) => Promise<any>
    insertImages: (images: any[]) => Promise<any[]>
    updateImage: (uuid: string, updates: any) => Promise<{ success: boolean }>
    deleteImage: (uuid: string) => Promise<{ success: boolean }>
    deleteImages: (uuids: string[]) => Promise<{ success: boolean }>
    searchImages: (query: string) => Promise<any[]>
    clearAllImages: () => Promise<{ success: boolean }>
    getSyncMetadata: () => Promise<{ lastSyncSequence: number; lastSyncTime: string | null }>
    updateSyncMetadata: (metadata: any) => Promise<{ success: boolean }>
  }
}

// Vite environment variables
interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  // Add more environment variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }

  interface LocalImageFile {
  name: string
  path: string
  size: number
  createdAt: string
  modifiedAt: string
}

}

export {}
