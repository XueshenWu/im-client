import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Add your API methods here
  // Example:
  // sendMessage: (message: string) => ipcRenderer.send('message', message),
  // onReply: (callback: (event: any, ...args: any[]) => void) => ipcRenderer.on('reply', callback),
})
