/// <reference types="vite/client" />

import { deleteImages } from "./services"

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
  saveImageBuffer: (uuid: string, format: string, buffer: ArrayBuffer) => Promise<string | null>
  saveThumbnailBuffer: (uuid: string, buffer: ArrayBuffer) => Promise<string | null>
  deleteLocalFiles: (uuids: Array<{ uuid: string; format: string }>) => Promise<Array<{ uuid: string; success: boolean; error?: any }> | null>
  openDialog: () => Promise<string[]>
  selectDirectory: () => Promise<string | null>
  saveFilesToLocal: (files: Array<{ sourcePath: string; uuid: string; format: string }>) => Promise<{
    success: boolean
    savedFiles?: string[]
    directory?: string
    error?: string
  }>
  saveThumbnailsToLocal: (files: Array<{ sourcePath: string; uuid: string }>) => Promise<{
    success: boolean
    savedFiles?: string[]
    directory?: string
    error?: string
  }>
  generateThumbnail: (sourcePath: string, uuid: string) => Promise<{
    success: boolean
    thumbnailPath?: string
    imageBuffer?: number[]
    sourcePath?: string
    error?: string
  }>
  saveGeneratedThumbnail: (thumbnailPath: string, buffer: ArrayBuffer) => Promise<{
    success: boolean
    thumbnailPath?: string
    error?: string
  }>
  calculateFileHash: (filePath: string) => Promise<{
    success: boolean
    hash?: string
    error?: string
  }>
  getImgMetadata: (filePath: string) => Promise<{
    success: boolean
    pageCount?: number
    pages?: Array<{ width: number; height: number }>
    format?: string
    error?: string
  }>
  getTiffPage: (filePath: string, pageIndex: number) => Promise<{
    success: boolean
    buffer?: number[]
    width?: number
    height?: number
    pageIndex?: number
    error?: string
  }>
  loadLocalImage: (uuid: string, format: string) => Promise<Buffer>
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
    images: Array<{ uuid: string; format: string; filename: string }>,
    destination: string
  ) => Promise<{
    success: boolean
    results?: Array<{ uuid: string; success: boolean; path?: string; error?: string }>
    error?: string
  }>

  deleteImages: (image_names: string[]) => Promise<string[]>,
  prepareLocalTiffImage: (uuid: string, format: string, pageIndex: number) => Promise<{
    success: boolean,
    previewSrc: string,
    metadata: {
      width: number,
      height: number,
      totalPages: number,
      currentPage: number
    }
  }>


  // Database operations
  db: {
    initialize: () => Promise<{ success: boolean; error?: string }>
    getAllImages: () => Promise<any[]>
    getImageByUuid: (uuid: string) => Promise<any | undefined>
    getImageFormatByUUIDs: (uuids: string[]) => Promise<Array<{ uuid: string; format: string }>>
    getPaginatedImages: (page: number, pageSize: number, sortBy?: string, sortOrder?: string) => Promise<{ images: any[]; total: number }>
    insertImage: (image: any) => Promise<any>
    insertImages: (images: any[]) => Promise<any[]>
    updateImage: (uuid: string, updates: any) => Promise<{ success: boolean }>
    deleteImage: (uuid: string) => Promise<{ success: boolean }>
    deleteImages: (uuids: string[]) => Promise<{ success: boolean }>
    searchImages: (query: string) => Promise<any[]>
    clearAllImages: () => Promise<{ success: boolean }>
    getSyncMetadata: () => Promise<{ lastSyncSequence: number; lastSyncTime: string | null; lastSyncUUID: string | null }>
    updateSyncMetadata: (metadata: { lastSyncSequence?: number; lastSyncTime?: string | null; lastSyncUUID?: string | null }) => Promise<{ success: boolean }>
    getExifData: (uuid: string) => Promise<ExifData | null>
    upsertExifData: (uuid: string, exif: any) => Promise<{ id: number; changes: number}>
    getAllImagesWithExif: () => Promise<any[]>
  },
  tiff: {
    loadBuffer: (buffer: Uint8Array) => Promise<{ success: boolean, pageCount?: number, error?: any }>
    getPreview: (pageIndex: number) => Promise<{
      success: boolean,
      previewSrc: string,
      metadata: {
        width: number,
        height: number,
        totalPages: number,
        currentPage: number
      }
    }>
    cropPage: (pageIndex: number, crop: { x: number, y: number, width: number, height: number }) => Promise<{
      success: boolean,
      buffer?: Buffer,
      error?: string
    }>
    replacePage: (pageIndex: number, newPageBuffer: Buffer) => Promise<{
      success: boolean,
      error?: string
    }>
    appendPage: (newPageBuffer: Buffer) => Promise<{
      success: boolean,
      totalPages?: number,
      error?: string
    }>
    getFinalBuffer: () => Promise<{
      success: boolean,
      buffer?: Buffer,
      metadata?: {
        totalPages: number,
        pageDimensions: Array<{ width: number, height: number }>,
        fileSize: number
      },
      error?: string
    }>
    cleanup: () => Promise<{ success: boolean, error?: string }>
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
    electron: {
      invoke: (channel: string, ...args: any[]) => Promise<any>
    }
  }

  interface LocalImageFile {
    name: string
    path: string
    size: number
    createdAt: string
    modifiedAt: string
  }

}

export { }
