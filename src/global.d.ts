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
  getFilePath: (file: File) => string
  expandPath: (path: string, recursive?: boolean) => Promise<string[]>
  readLocalFile: (path: string) => Promise<ArrayBuffer | null>
  writeTempFile: (fileName: string, buffer: ArrayBuffer) => Promise<string | null>
  openDialog: () => Promise<string[]>
  saveFilesToLocal: (filePaths: string[]) => Promise<{
    success: boolean
    savedFiles?: string[]
    directory?: string
    error?: string
  }>
  getLocalImages: (options?: { limit?: number; offset?: number }) => Promise<{
    success: boolean
    data: LocalImageFile[]
    total: number
    hasMore: boolean
    error?: string
  }>,
  getDeviceId: () => Promise<string>;
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
