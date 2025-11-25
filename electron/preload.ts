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
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  readLocalFile: (path: string) => ipcRenderer.invoke('read-local-file', path),
  writeTempFile: (fileName: string, buffer: ArrayBuffer) =>
    ipcRenderer.invoke('write-temp-file', fileName, buffer),
  saveImageBuffer: (fileName: string, buffer: ArrayBuffer) =>
    ipcRenderer.invoke('save-image-buffer', fileName, buffer),
  saveThumbnailBuffer: (fileName: string, buffer: ArrayBuffer) =>
    ipcRenderer.invoke('save-thumbnail-buffer', fileName, buffer),
  saveFilesToLocal: (filePaths: string[]) => ipcRenderer.invoke('save-files-to-local', filePaths),
  getLocalImages: (options?: { limit?: number; offset?: number }) =>
    ipcRenderer.invoke('get-local-images', options),
  getDeviceId: () => ipcRenderer.invoke('get-device-id'),
  exportImages: (images: Array<{uuid: string, filePath: string, filename: string}>, destination: string) =>
    ipcRenderer.invoke('export-images', images, destination),
  getRoamPath: () => ipcRenderer.invoke('get-roam-path'),
  saveThumbnailsToLocal: (filePaths: string[]) =>
    ipcRenderer.invoke('save-thumbnails-to-local', filePaths),

  // Database operations
  db: {
    initialize: () => ipcRenderer.invoke('db:initialize'),
    getAllImages: () => ipcRenderer.invoke('db:getAllImages'),
    getImageByUuid: (uuid: string) => ipcRenderer.invoke('db:getImageByUuid', uuid),
    getPaginatedImages: (page: number, pageSize: number, sortBy?: string, sortOrder?: string) =>
      ipcRenderer.invoke('db:getPaginatedImages', page, pageSize, sortBy, sortOrder),
    insertImage: (image: any) => ipcRenderer.invoke('db:insertImage', image),
    insertImages: (images: any[]) => ipcRenderer.invoke('db:insertImages', images),
    updateImage: (uuid: string, updates: any) => ipcRenderer.invoke('db:updateImage', uuid, updates),
    deleteImage: (uuid: string) => ipcRenderer.invoke('db:deleteImage', uuid),
    deleteImages: (uuids: string[]) => ipcRenderer.invoke('db:deleteImages', uuids),
    searchImages: (query: string) => ipcRenderer.invoke('db:searchImages', query),
    clearAllImages: () => ipcRenderer.invoke('db:clearAllImages'),
    getSyncMetadata: () => ipcRenderer.invoke('db:getSyncMetadata'),
    updateSyncMetadata: (metadata: any) => ipcRenderer.invoke('db:updateSyncMetadata', metadata),
  }
})
