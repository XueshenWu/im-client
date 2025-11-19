import { contextBridge, ipcRenderer, webUtils } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  getFilePath: (file:File) => webUtils.getPathForFile(file),
  expandPath: (path: string, recursive: boolean) =>
    ipcRenderer.invoke('expand-path', path, recursive),
  openDialog: () => ipcRenderer.invoke('dialog:open'),
  readLocalFile: (path: string) => ipcRenderer.invoke('read-local-file', path),
  saveFilesToLocal: (filePaths: string[]) => ipcRenderer.invoke('save-files-to-local', filePaths),
})
