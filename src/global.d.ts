export {}

declare global {
  interface Window {
    electronAPI?: {
      // Add your API method types here
      // Example:
      // sendMessage: (message: string) => void
      // onReply: (callback: (event: any, ...args: any[]) => void) => void
    }
  }
}
