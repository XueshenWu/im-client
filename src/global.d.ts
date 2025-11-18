export {}

// CSS modules
declare module '*.css' {
  const content: Record<string, string>
  export default content
}

// Vite environment variables
interface ImportMetaEnv {
  readonly VITE_API_URL: string
  // Add more environment variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare global {
  interface Window {
    electronAPI?: {
      // Window controls
      minimizeWindow: () => void
      maximizeWindow: () => void
      closeWindow: () => void
    }
  }
}
