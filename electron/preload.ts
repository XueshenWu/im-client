import { contextBridge, ipcRenderer, webUtils } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  setWindowTitle: (title: string) => ipcRenderer.send('set-window-title', title),
  getFilePath: (file: File) => webUtils.getPathForFile(file),
  expandPath: (path: string, recursive: boolean) =>
    ipcRenderer.invoke('expand-path', path, recursive),
  openDialog: () => ipcRenderer.invoke('dialog:open'),
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  readLocalFile: (path: string) => ipcRenderer.invoke('read-local-file', path),
  writeTempFile: (fileName: string, buffer: ArrayBuffer) =>
    ipcRenderer.invoke('write-temp-file', fileName, buffer),
  saveImageBuffer: (uuid: string, format: string, buffer: ArrayBuffer) =>
    ipcRenderer.invoke('save-image-buffer', uuid, format, buffer),
  saveThumbnailBuffer: (uuid: string, buffer: ArrayBuffer) =>
    ipcRenderer.invoke('save-thumbnail-buffer', uuid, buffer),
  saveFilesToLocal: (files: Array<{ sourcePath: string; uuid: string; format: string }>) =>
    ipcRenderer.invoke('save-files-to-local', files),
  getLocalImages: (options?: { limit?: number; offset?: number }) =>
    ipcRenderer.invoke('get-local-images', options),
  getDeviceId: () => ipcRenderer.invoke('get-device-id'),
  prepareLocalTiffImage: (uuid: string, format: string, pageIndex: number) => ipcRenderer.invoke('prepare-local-tiff-image', uuid, format, pageIndex),
  exportImages: (images: Array<{ uuid: string, format: string, filename: string }>, destination: string) =>
    ipcRenderer.invoke('export-images', images, destination),
  getRoamPath: () => ipcRenderer.invoke('get-roam-path'),
  saveThumbnailsToLocal: (files: Array<{ sourcePath: string; uuid: string }>) =>
    ipcRenderer.invoke('save-thumbnails-to-local', files),
  generateThumbnail: (sourcePath: string, uuid: string) =>
    ipcRenderer.invoke('generate-thumbnail', sourcePath, uuid),
  saveGeneratedThumbnail: (thumbnailPath: string, buffer: ArrayBuffer) =>
    ipcRenderer.invoke('save-generated-thumbnail', thumbnailPath, buffer),
  calculateFileHash: (filePath: string) =>
    ipcRenderer.invoke('calculate-file-hash', filePath),
  deleteImages: (image_names: string[]) => ipcRenderer.invoke('delete-images', image_names),
  getImgMetadata: (filePath: string) =>
    ipcRenderer.invoke('get-img-metadata', filePath),
  getTiffPage: (filePath: string, pageIndex: number) =>
    ipcRenderer.invoke('get-tiff-page', filePath, pageIndex),
  loadLocalImage: (uuid: string, format: string) =>
    ipcRenderer.invoke('load-local-image', uuid, format),
  // Database operations
  db: {
    initialize: () => ipcRenderer.invoke('db:initialize'),
    getAllImages: () => ipcRenderer.invoke('db:getAllImages'),
    getImageByUuid: (uuid: string) => ipcRenderer.invoke('db:getImageByUuid', uuid),
    getImageFormatByUUIDs: (uuids: string[]) => ipcRenderer.invoke('db:getImageFormatByUUIDs', uuids),
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
    getExifData: (uuid: string) => ipcRenderer.invoke('db:getExifData', uuid),
    upsertExifData: (uuid: string, exif: any) => ipcRenderer.invoke('db:upsertExifData', uuid, exif),
    getAllImagesWithExif: () => ipcRenderer.invoke('db:getAllImagesWithExif')
  },
  tiff: {
    loadBuffer: (buffer: Uint8Array) => ipcRenderer.invoke('tiff:load-buffer', buffer),
    getPreview: (pageIndex: number) => ipcRenderer.invoke('tiff:get-preview', pageIndex),
    cropPage: (pageIndex: number, crop: { x: number, y: number, width: number, height: number }) =>
      ipcRenderer.invoke('tiff:crop-page', pageIndex, crop),
    replacePage: (pageIndex: number, newPageBuffer: Buffer) =>
      ipcRenderer.invoke('tiff:replace-page', pageIndex, newPageBuffer),
    appendPage: (newPageBuffer: Buffer) => ipcRenderer.invoke('tiff:append-page', newPageBuffer),
    getFinalBuffer: () => ipcRenderer.invoke('tiff:get-final-buffer'),
    cleanup: () => ipcRenderer.invoke('tiff:cleanup')
  }
})
