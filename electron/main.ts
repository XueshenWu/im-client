import { app, BrowserWindow, ipcMain, dialog, protocol, net, shell } from 'electron'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import si from 'systeminformation'
import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import sharp from 'sharp';
import * as utif from 'utif';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url)

const __dirname = path.dirname(__filename)
sharp.cache(false);

import fs from 'fs/promises'
import { initializeDatabase, dbOperations, closeDatabase } from './database.js'


let pageBuffers: Buffer[] = [];
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-image',
    privileges: {
      secure: true,           // Treats as HTTPS (secure context)
      standard: true,         // Handles URL resolution like http://
      supportFetchAPI: true,  // Allows fetch() calls
      bypassCSP: true,        // Helps avoid some CSP headers issues
      stream: true            // Efficient streaming
    }
  },
  {
    scheme: 'local-thumbnail',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      bypassCSP: true,
      stream: true
    }
  }
]);

// Helper to normalize file format extensions
const normalizeFormat = (format: string): string => {
  const normalized = format.toLowerCase().replace(/^\./, '');
  switch (normalized) {
    case 'jpg':
    case 'jpeg':
      return 'jpeg';
    case 'tif':
    case 'tiff':
      return 'tiff';
    case 'png':
      return 'png';
    default:
      return normalized;
  }
};

// Helper to validate files
const isImage = (filename: string) => {
  return /\.(jpg|jpeg|png|tif|tiff)$/i.test(filename);
};

// Helper to validate all supported file types (images, zip, json)
const isValidFile = (filename: string) => {
  return /\.(jpg|jpeg|png|tif|tiff|zip|json)$/i.test(filename);
};
// Recursive Walker Function
async function getFilePaths(dirPath: string, recursive: boolean): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // If recursive is true, dive in. If false, ignore subdirectory.
      return recursive ? getFilePaths(fullPath, recursive) : [];
    } else {
      return isImage(entry.name) ? fullPath : [];
    }
  }));

  return files.flat();
}


function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    },
  })

  // Set Content Security Policy to allow API connections
  
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "connect-src 'self' data: http://localhost:* local-image: local-thumbnail: http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:* http://192.168.0.24.nip.io:9999 http://s3.192.168.0.24.nip.io:9999; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:8097; " +
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
          "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
          "img-src 'self' data: blob: local-image: local-thumbnail: http://localhost:* http://127.0.0.1:* https: http://192.168.0.24.nip.io:9999 http://s3.192.168.0.24.nip.io:9999; " +
          "font-src 'self' data: https://fonts.gstatic.com;"
        ]
      }
    })
  })
 

  // Window control handlers
  ipcMain.on('minimize-window', () => {
    mainWindow.minimize()
  })

  ipcMain.on('maximize-window', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  })

  ipcMain.on('close-window', () => {
    mainWindow.close()
  })

  ipcMain.on('set-window-title', (_event, title: string) => {
    mainWindow.setTitle(title)
  })


  ipcMain.handle('tiff:load-buffer', async (_, buffer: Uint8Array) => {
    try {
      // Get metadata to find total pages
      const metadata = await sharp(buffer).metadata();
      const pageCount = metadata.pages || 1;

      // Split the multi-page TIFF into individual TIFF buffers using Sharp
      const splitPromises = [];
      for (let i = 0; i < pageCount; i++) {
        splitPromises.push(
          sharp(buffer, { page: i })
            .tiff({ compression: 'lzw' }) // Save as high-quality TIFF in RAM
            .toBuffer()
        );
      }

      pageBuffers = await Promise.all(splitPromises);

      console.log(`Loaded ${pageBuffers.length} pages via Sharp.`);
      return { success: true, pageCount: pageBuffers.length };

    } catch (error: any) {
      console.error("Load Error:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('tiff:get-preview', async (_, pageIndex: number) => {
    // Bounds check
    if (!pageBuffers[pageIndex]) {
      return { success: false, error: `Page ${pageIndex} out of bounds` };
    }

    try {
      const currentBuffer = pageBuffers[pageIndex];

      // Read metadata from the specific page buffer
      const metadata = await sharp(currentBuffer).metadata();

      const previewBuffer = await sharp(currentBuffer)
        .rotate() // Auto-rotate based on EXIF
        .resize({
          width: 2000,
          height: 2000,
          fit: 'inside',
          withoutEnlargement: true
        })
        .toFormat('png')
        .toBuffer();

      return {
        success: true,
        previewSrc: `data:image/png;base64,${previewBuffer.toString('base64')}`,
        metadata: {
          width: metadata.width,
          height: metadata.height,
          totalPages: pageBuffers.length,
          currentPage: pageIndex
        }
      };

    } catch (error: any) {
      console.error(`Error processing page ${pageIndex}:`, error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('tiff:crop-page', async (_, pageIndex: number, crop: { x: number, y: number, width: number, height: number }) => {
    if (!pageBuffers[pageIndex]) {
      return { success: false, error: `Page ${pageIndex} out of bounds` };
    }

    try {
      const currentBuffer = pageBuffers[pageIndex];

      // create the preview PNG
      const previewPngBuffer = await sharp(currentBuffer)
        .rotate()
        .resize({
          width: 2000,
          height: 2000,
          fit: 'inside',
          withoutEnlargement: true
        })
        .png()
        .toBuffer();

      const previewMetadata = await sharp(previewPngBuffer).metadata();
      const previewWidth = previewMetadata.width || 0;
      const previewHeight = previewMetadata.height || 0;

      // Validate and clamp crop coordinates to prevent extraction errors
      let x = Math.max(0, Math.min(Math.round(crop.x), previewWidth - 1));
      let y = Math.max(0, Math.min(Math.round(crop.y), previewHeight - 1));
      let width = Math.max(1, Math.min(Math.round(crop.width), previewWidth - x));
      let height = Math.max(1, Math.min(Math.round(crop.height), previewHeight - y));

      console.log('Cropping from preview PNG:', {
        pageIndex,
        previewDimensions: { width: previewWidth, height: previewHeight },
        cropDataReceived: crop,
        cropDataClamped: { x, y, width, height }
      });

      // Crop the preview PNG, then convert back to TIFF
      const croppedBuffer = await sharp(previewPngBuffer)
        .extract({
          left: x,
          top: y,
          width: width,
          height: height
        })
        .tiff({ compression: 'lzw' })
        .toBuffer();

      const croppedMetadata = await sharp(croppedBuffer).metadata();
      console.log('Cropped result:', { width: croppedMetadata.width, height: croppedMetadata.height });

      return { success: true, buffer: croppedBuffer };
    } catch (error: any) {
      console.error(`Error cropping page ${pageIndex}:`, error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('tiff:replace-page', async (_, pageIndex: number, newPageBuffer: Buffer) => {
    if (pageIndex < 0 || pageIndex >= pageBuffers.length) {
      return { success: false, error: `Page ${pageIndex} out of bounds` };
    }

    try {
      pageBuffers[pageIndex] = newPageBuffer;
      return { success: true };
    } catch (error: any) {
      console.error(`Error replacing page ${pageIndex}:`, error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('tiff:append-page', async (_, newPageBuffer: Buffer) => {
    try {
      // Append the new page to the buffer array
      pageBuffers.push(newPageBuffer);
      return { success: true, totalPages: pageBuffers.length };
    } catch (error: any) {
      console.error('Error appending page:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('tiff:get-final-buffer', async () => {
    try {
      if (pageBuffers.length === 0) {
        return { success: false, error: 'No pages loaded' };
      }

      console.log(`Processing ${pageBuffers.length} pages for multi-page TIFF`);

      const pages = [];

      // Decode and prepare raw IFDs
      for (let i = 0; i < pageBuffers.length; i++) {
        const buffer = pageBuffers[i];
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;

        const decoded = utif.decode(arrayBuffer);
        const rawIfd = decoded[0];
        utif.decodeImage(arrayBuffer, rawIfd);

        const cleanIfd = Object.create(null);

        // Copy standard tags
        cleanIfd.t256 = rawIfd.t256; // Width
        cleanIfd.t257 = rawIfd.t257; // Height
        cleanIfd.t258 = rawIfd.t258; // BitsPerSample
        cleanIfd.t259 = [1];         // Compression (1 = None)
        cleanIfd.t262 = rawIfd.t262; // Photometric
        cleanIfd.t277 = rawIfd.t277; // SamplesPerPixel
        cleanIfd.t278 = rawIfd.t257; // RowsPerStrip

        pages.push({
          ifd: cleanIfd,
          data: Buffer.from(rawIfd.data)
        });
      }

      // TIFF spec requires tag s to be written in ascending order (256 < 257 < ... < 273)
      const getSortedIfd = (unsortedIfd: any) => {
        const sorted = Object.create(null);
        const keys = Object.keys(unsortedIfd).sort((a, b) => {
          return parseInt(a.slice(1)) - parseInt(b.slice(1));
        });

        keys.forEach(key => {
          sorted[key] = unsortedIfd[key];
        });
        return sorted;
      };


      // Set fixed ByteCounts (t279)
      pages.forEach(p => {
        p.ifd.t279 = [p.data.length];
      });

      // Set dummy Offsets (t273) for header size calculation
      pages.forEach(p => p.ifd.t273 = [0]);

      // SORT BEFORE DUMMY ENCODE
      let ifdList = pages.map(p => getSortedIfd(p.ifd));

      const dummyHeader = utif.encode(ifdList);
      const headerSize = dummyHeader.byteLength;

      console.log(`Metadata Header Size: ${headerSize} bytes`);

      // Update Real Offsets
      let currentOffset = headerSize;
      pages.forEach(p => {
        p.ifd.t273 = [currentOffset];
        currentOffset += p.data.length;
      });

      // Re-sort and encode
      ifdList = pages.map(p => getSortedIfd(p.ifd));

      const finalHeaderBuffer = Buffer.from(utif.encode(ifdList));

      const parts = [finalHeaderBuffer];
      pages.forEach(p => {
        parts.push(p.data);
      });

      const finalBuffer = Buffer.concat(parts);

      const pageDimensions = pages.map(p => ({
        width: p.ifd.t256[0],
        height: p.ifd.t257[0]
      }));

      console.log(`Multi-page TIFF created successfully. Total size: ${finalBuffer.length}`);
      return {
        success: true,
        buffer: finalBuffer,
        metadata: {
          totalPages: pages.length,
          pageDimensions: pageDimensions,
          fileSize: finalBuffer.length
        }
      };

    } catch (error: any) {
      console.error('Error getting final buffer:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('tiff:cleanup', async () => {
    try {
      // free memory
      pageBuffers = [];
      return { success: true };
    } catch (error: any) {
      console.error('Error cleaning up TIFF buffers:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('expand-path', async (event, targetPath, recursive = false) => {
    try {
      const stats = await fs.stat(targetPath);

      if (stats.isDirectory()) {
        return await getFilePaths(targetPath, recursive);
      } else {
        // Check if it's a valid supported file (image, zip, or json)
        const filename = path.basename(targetPath);
        return isValidFile(filename) ? [targetPath] : [];
      }
    } catch (error) {
      console.error(`Error expanding path ${targetPath}:`, error);
      return [];
    }
  });

  ipcMain.handle('read-local-file', async (event, filePath) => {
    try {
      if (typeof filePath !== 'string') {
        console.error('Invalid path received');
        return null;
      }

      // Read the file from disk
      const buffer = await fs.readFile(filePath);
      return buffer;
    } catch (error) {
      console.error('Failed to read file:', filePath, error);
      return null;
    }
  });






  ipcMain.handle('tiff:prepare-local-tiff-image', async (_, uuid: string, format: string, pageIndex: number) => {

    try {
      const filePath = path.join(app.getPath('appData'), 'image-management', 'images', `${uuid}.${format}`);
      const metadata = await sharp(filePath).metadata();

      const totalPages = metadata.pages || 1;
      if (pageIndex >= totalPages) {
        throw new Error(`Page ${pageIndex} out of bounds. Total pages: ${totalPages}`);
      }

      const image = sharp(filePath, { page: pageIndex })
      const previewBuffer = await image
        .rotate()
        .resize({
          width: 2000,
          height: 2000,
          fit: 'inside',
          withoutEnlargement: true
        })
        .toFormat('png')
        .toBuffer();

      return {
        success: true,
        previewSrc: `data:image/png;base64,${previewBuffer.toString('base64')}`,
        metadata: {
          width: metadata.width,
          height: metadata.height,
          totalPages: totalPages,
          currentPage: pageIndex
        }
      };


    } catch (error: any) {

      console.error('Error processing TIFF:', error);
      return { success: false, error: error.message };
    }


  })

  ipcMain.handle('load-local-image', async (_, uuid: string, format: string) => {
    const filePath = path.join(app.getPath('appData'), 'image-management', 'images', `${uuid}.${format}`);
    return await fs.readFile(filePath)

  })


  ipcMain.handle('get-roam-path', () => {
    return path.join(app.getPath('appData'), 'image-management');
  });

  ipcMain.handle('save-thumbnails-to-local', async (event, files: Array<{ sourcePath: string; uuid: string }>) => {
    try {
      // Get AppData directory for this app
      const appDataPath = path.join(app.getPath('appData'), 'image-management', 'thumbnails');

      // Ensure the directory exists
      await fs.mkdir(appDataPath, { recursive: true });

      const savedFiles: string[] = [];

      for (const file of files) {
        try {
          const destPath = path.join(appDataPath, `${file.uuid}.jpeg`);

          await fs.copyFile(file.sourcePath, destPath);
          savedFiles.push(destPath);
        } catch (error) {
          console.error(`Failed to save thumbnail ${file.sourcePath}:`, error);
        }
      }

      return {
        success: true,
        savedFiles,
        directory: appDataPath,
      };
    } catch (error) {
      console.error('Failed to save files to local:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });




  ipcMain.handle('save-files-to-local', async (event, files: Array<{ sourcePath: string; uuid: string; format: string }>) => {
    try {
      // Get AppData directory for this app
      const appDataPath = path.join(app.getPath('appData'), 'image-management', 'images');

      await fs.mkdir(appDataPath, { recursive: true });

      const savedFiles: string[] = [];

      for (const file of files) {
        try {
          // Normalize the format to ensure consistency
          const normalizedFormat = normalizeFormat(file.format);
          const destPath = path.join(appDataPath, `${file.uuid}.${normalizedFormat}`);

          // Copy file to AppData with UUID-based name
          await fs.copyFile(file.sourcePath, destPath);
          savedFiles.push(destPath);
        } catch (error) {
          console.error(`Failed to save file ${file.sourcePath}:`, error);
        }
      }

      return {
        success: true,
        savedFiles,
        directory: appDataPath,
      };
    } catch (error) {
      console.error('Failed to save files to local:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle('get-local-images', async (event, options: { limit?: number; offset?: number } = {}) => {
    try {
      const { limit = 20, offset = 0 } = options;
      const appDataPath = path.join(app.getPath('appData'), 'image-management', 'images');

      await fs.mkdir(appDataPath, { recursive: true });

      // Read all files in the directory
      const files = await fs.readdir(appDataPath);

      // Filter for image files and get stats
      const imageFiles = await Promise.all(
        files
          .filter(file => isImage(file))
          .map(async (file) => {
            const filePath = path.join(appDataPath, file);
            const stats = await fs.stat(filePath);
            return {
              name: file,
              path: filePath,
              size: stats.size,
              createdAt: stats.birthtime.toISOString(),
              modifiedAt: stats.mtime.toISOString(),
            };
          })
      );

      // Sort by creation date
      imageFiles.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Apply pagination
      const paginatedFiles = imageFiles.slice(offset, offset + limit);

      return {
        success: true,
        data: paginatedFiles,
        total: imageFiles.length,
        hasMore: offset + limit < imageFiles.length,
      };
    } catch (error) {
      console.error('Failed to get local images:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: [],
        total: 0,
        hasMore: false,
      };
    }
  });
  ipcMain.handle('get-device-id', async () => {
    try {
      // Get Hardware UUID
      const systemData = await si.uuid();
      const rawId = systemData.os || systemData.hardware;

      return crypto.createHash('sha256').update(rawId + 'my-salt').digest('hex');
    } catch (error) {
      console.error('Hardware ID failed, falling back to random UUID', error);
      return uuidv4();
    }
  });

  ipcMain.handle('write-temp-file', async (event, fileName: string, buffer: ArrayBuffer) => {
    try {
      // Create temp directory for ZIP-extracted files
      const tempDir = path.join(app.getPath('temp'), 'image-management', 'zip-extracted');
      await fs.mkdir(tempDir, { recursive: true });

      const filePath = path.join(tempDir, fileName);
      await fs.writeFile(filePath, Buffer.from(buffer));

      return filePath;
    } catch (error) {
      console.error('Failed to write temp file:', error);
      return null;
    }
  });



  ipcMain.handle('save-image-buffer', async (event, uuid: string, format: string, buffer: ArrayBuffer) => {
    try {
      const appDataPath = path.join(app.getPath('appData'), 'image-management', 'images');
      await fs.mkdir(appDataPath, { recursive: true });

      const normalizedFormat = normalizeFormat(format);
      const filePath = path.join(appDataPath, `${uuid}.${normalizedFormat}`);

      try {
        await fs.unlink(filePath);
      } catch (error: any) {
        // Throw if strictly locked/permission error (EBUSY/EPERM)
        if (error.code !== 'ENOENT') {
          console.error('Error deleting old image:', error);
          throw error;
        }
      }

      // Write the new image file
      await fs.writeFile(filePath, Buffer.from(buffer));

      return filePath;
    } catch (error) {
      console.error('Failed to save image buffer:', error);
      return null;
    }
  });

  // Save downloaded thumbnail buffer to AppData
  ipcMain.handle('save-thumbnail-buffer', async (event, uuid: string, buffer: ArrayBuffer) => {
    try {
      const appDataPath = path.join(app.getPath('appData'), 'image-management', 'thumbnails');
      await fs.mkdir(appDataPath, { recursive: true });

      const filePath = path.join(appDataPath, `${uuid}.jpeg`);
      await fs.writeFile(filePath, Buffer.from(buffer));

      return filePath;
    } catch (error) {
      console.error('Failed to save thumbnail buffer:', error);
      return null;
    }
  });

  // Delete image and thumbnail files from AppData
  ipcMain.handle('delete-local-files', async (_event, uuids: Array<{ uuid: string; format: string }>) => {
    try {
      const imagesPath = path.join(app.getPath('appData'), 'image-management', 'images');
      const thumbnailsPath = path.join(app.getPath('appData'), 'image-management', 'thumbnails');

      const results = [];
      for (const { uuid, format } of uuids) {
        try {
          const normalizedFormat = normalizeFormat(format);
          const imagePath = path.join(imagesPath, `${uuid}.${normalizedFormat}`);
          const thumbnailPath = path.join(thumbnailsPath, `${uuid}.jpeg`);

          // Delete file
          try {
            await fs.unlink(imagePath);
          } catch (error: any) {
            if (error.code !== 'ENOENT') {
              console.error(`Failed to delete image file ${uuid}:`, error);
            }
          }

          try {
            await fs.unlink(thumbnailPath);
          } catch (error: any) {
            if (error.code !== 'ENOENT') {
              console.error(`Failed to delete thumbnail file ${uuid}:`, error);
            }
          }

          results.push({ uuid, success: true });
        } catch (error) {
          console.error(`Failed to delete files for ${uuid}:`, error);
          results.push({ uuid, success: false, error });
        }
      }

      return results;
    } catch (error) {
      console.error('Failed to delete local files:', error);
      return null;
    }
  });


  ipcMain.handle('dialog:open', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select Images',
      defaultPath: app.getPath('pictures'), // Start in Pictures folder
      properties: [
        'openFile',        
        'multiSelections',
      ],
      filters: [
        { name: 'Supported Files', extensions: ['jpg', 'jpeg', 'png', 'tif', 'tiff', 'zip', 'json'] }
      ]
    });

    if (canceled) {
      return [];
    } else {
      return filePaths;
    }
  });

  ipcMain.handle('db:initialize', async () => {
    try {
      await initializeDatabase();
      return { success: true };
    } catch (error) {
      console.error('Failed to initialize database:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('db:getAllImages', async () => {
    try {
      return dbOperations.getAllImages();
    } catch (error) {
      console.error('Failed to get all images:', error);
      return [];
    }
  });

  ipcMain.handle('db:getImageByUuid', async (event, uuid: string) => {
    try {
      return dbOperations.getImageByUuid(uuid);
    } catch (error) {
      console.error('Failed to get image by UUID:', error);
      return null;
    }
  });

  ipcMain.handle('db:getImageFormatByUUIDs', async (_, uuids: string[]) => {
    try {
      return dbOperations.getImageFormatByUUIDs(uuids);
    } catch (error) {
      console.error('Failed to get image formats by UUIDs:', error);
      return [];
    }
  });

  ipcMain.handle('db:getPaginatedImages', async (event, page: number, pageSize: number, sortBy?: string, sortOrder?: string) => {
    try {
      return dbOperations.getPaginatedImages(
        page,
        pageSize,
        sortBy as any,
        sortOrder as 'asc' | 'desc'
      );
    } catch (error) {
      console.error('Failed to get paginated images:', error);
      return { images: [], total: 0 };
    }
  });

  ipcMain.handle('db:insertImage', async (event, image: any) => {
    try {
      return dbOperations.insertImage(image);
    } catch (error) {
      console.error('Failed to insert image:', error);
      throw error;
    }
  });

  ipcMain.handle('db:insertImages', async (event, images: any[]) => {
    try {
      return dbOperations.insertImages(images);
    } catch (error) {
      console.error('Failed to insert images:', error);
      return [];
    }
  });

  ipcMain.handle('db:getExifData', async (event, uuid: string) => {
    try {
      const exifData = await dbOperations.getExifDataByUuid(uuid);
      return exifData;
    } catch (error) {
      console.error('Failed to get exif data:', error);
      return null;
    }
  });

  ipcMain.handle('db:upsertExifData', async (event, uuid: string, exif: any) => {
    try {
      const result = await dbOperations.upsertExifData(uuid, exif);
      return result;
    } catch (error) {
      console.error('Failed to upsert exif:', error);
      throw error;
    }
  })

  ipcMain.handle('db:updateImage', async (event, uuid: string, updates: any) => {
    try {
      await dbOperations.updateImage(uuid, updates);
      return { success: true };
    } catch (error) {
      console.error('Failed to update image:', error);
      throw error;
    }
  });



  ipcMain.handle('db:deleteImage', async (_, uuid: string) => {
    try {
      // Get format before deleting from DB
      const formats = await dbOperations.getImageFormatByUUIDs([uuid]);

      await dbOperations.deleteImage(uuid);

      if (formats && formats.length > 0) {
        const { getImagePath, getThumbnailPath } = await import('./database.js');
        const imagePath = getImagePath(uuid, formats[0].format);
        const thumbnailPath = getThumbnailPath(uuid);

        await shell.trashItem(imagePath);
        await shell.trashItem(thumbnailPath);
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to delete image:', error);
      throw error;
    }
  });

  ipcMain.handle('db:deleteImages', async (_, uuids: string[]) => {
    try {
      // Get formats before deleting from DB
      const formats = await dbOperations.getImageFormatByUUIDs(uuids);

      await dbOperations.deleteImages(uuids);

      if (formats && formats.length > 0) {
        const { getImagePath, getThumbnailPath } = await import('./database.js');

        await Promise.allSettled(formats.flatMap(({ uuid, format }) => {
          const imagePath = getImagePath(uuid, format);
          const thumbnailPath = getThumbnailPath(uuid);

          return [
            shell.trashItem(imagePath),
            shell.trashItem(thumbnailPath)
          ]
        }))
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to delete images:', error);
      throw error;
    }
  });

  ipcMain.handle('db:searchImages', async (event, query: string) => {
    try {
      return dbOperations.searchImages(query);
    } catch (error) {
      console.error('Failed to search images:', error);
      return [];
    }
  });



  ipcMain.handle('db:clearAllImages', async () => {
    try {
      await dbOperations.clearAllImages();
      return { success: true };
    } catch (error) {
      console.error('Failed to clear all images:', error);
      throw error;
    }
  });

  ipcMain.handle('db:getSyncMetadata', async () => {
    try {
      return dbOperations.getSyncMetadata();
    } catch (error) {
      console.error('Failed to get sync metadata:', error);
      return { lastSyncSequence: 0, lastSyncTime: null, lastSyncUUID: null };
    }
  });

  ipcMain.handle('db:updateSyncMetadata', async (event, metadata: any) => {
    try {
      dbOperations.updateSyncMetadata(metadata);
      return { success: true };
    } catch (error) {
      console.error('Failed to update sync metadata:', error);
      throw error;
    }
  });

  ipcMain.handle('db:getAllImagesWithExif', async () => {
    try {
      const images = await dbOperations.getAllImagesWithExif();
      return images;
    } catch (error) {
      console.error('Failed to get all images with EXIF:', error);
      return [];
    }
  });

  // Export images to a directory
  ipcMain.handle('export-images', async (_, images: Array<{ uuid: string, format: string, filename: string }>, destination: string) => {
    try {
      await fs.mkdir(destination, { recursive: true });

      const { getImagePath } = await import('./database.js');

      const results = [];
      for (const image of images) {
        try {
          const sourcePath = getImagePath(image.uuid, image.format);
          const destPath = path.join(destination, image.filename);
          await fs.copyFile(sourcePath, destPath);
          results.push({ uuid: image.uuid, success: true, path: destPath });
        } catch (error) {
          console.error(`Failed to export image ${image.uuid}:`, error);
          results.push({ uuid: image.uuid, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }

      return { success: true, results };
    } catch (error) {
      console.error('Failed to export images:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Select directory dialog
  ipcMain.handle('dialog:selectDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select Export Directory',
      properties: ['openDirectory', 'createDirectory']
    });

    if (canceled || filePaths.length === 0) {
      return null;
    }
    return filePaths[0];
  });

  // Generate thumbnail from image file
  ipcMain.handle('generate-thumbnail', async (_, sourcePath: string, uuid: string) => {
    try {
      // Use canvas-based thumbnail generation instead of sharp
      const appDataPath = path.join(app.getPath('appData'), 'image-management', 'thumbnails');
      await fs.mkdir(appDataPath, { recursive: true });
      const metadata = await sharp(sourcePath).metadata();

      const thumbnailPath = path.join(appDataPath, `${uuid}.jpeg`);
      let imageBuffer: Buffer;

      if (metadata.format === 'tiff') {

        imageBuffer = await sharp(sourcePath, { page: 0 })
          .resize({ width: 300 })
          .jpeg({ quality: 80 })
          .toBuffer();

      } else {
        imageBuffer = await fs.readFile(sourcePath);
      }


      // Return the path and buffer for renderer to generate thumbnail
      return {
        success: true,
        thumbnailPath,
        imageBuffer: Array.from(imageBuffer),
        sourcePath,
      };
    } catch (error) {
      console.error('Failed to prepare thumbnail generation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Save generated thumbnail buffer
  ipcMain.handle('save-generated-thumbnail', async (_event, thumbnailPath: string, buffer: ArrayBuffer) => {
    try {
      await fs.writeFile(thumbnailPath, Buffer.from(buffer));
      return { success: true, thumbnailPath };
    } catch (error) {
      console.error('Failed to save thumbnail:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Get TIFF metadata (page count, dimensions for all pages)
  ipcMain.handle('get-img-metadata', async (_event, filePath: string) => {
    try {
      const metadata = await sharp(filePath).metadata();



      const pageCount = metadata.pages || 1;
      const pages: Array<{ width: number; height: number }> = [];

      // Extract dimensions for each page
      for (let i = 0; i < pageCount; i++) {
        const pageMetadata = await sharp(filePath, { page: i }).metadata();
        pages.push({
          width: pageMetadata.width || 0,
          height: pageMetadata.height || 0,
        });
      }

      return {
        success: true,
        pageCount,
        pages,
        format: metadata.format,
      };
    } catch (error) {
      console.error('Failed to get TIFF metadata:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Get specific TIFF page as image buffer
  ipcMain.handle('get-tiff-page', async (_event, filePath: string, pageIndex: number) => {
    try {
      const metadata = await sharp(filePath).metadata();

      if (metadata.format !== 'tiff' && metadata.format !== 'tif') {
        return {
          success: false,
          error: 'File is not a TIFF image',
        };
      }

      const pageCount = metadata.pages || 1;
      if (pageIndex < 0 || pageIndex >= pageCount) {
        return {
          success: false,
          error: `Invalid page index. File has ${pageCount} page(s).`,
        };
      }

      // Extract the specific page and convert to PNG for browser display
      const pageBuffer = await sharp(filePath, { page: pageIndex })
        .png()
        .toBuffer();

      const pageMetadata = await sharp(filePath, { page: pageIndex }).metadata();

      return {
        success: true,
        buffer: Array.from(pageBuffer),
        width: pageMetadata.width || 0,
        height: pageMetadata.height || 0,
        pageIndex,
      };
    } catch (error) {
      console.error('Failed to get TIFF page:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Calculate file hash (SHA-256)
  ipcMain.handle('calculate-file-hash', async (_event, filePath: string) => {
    try {
      const fileBuffer = await fs.readFile(filePath);
      const hashSum = crypto.createHash('sha256');
      hashSum.update(fileBuffer);
      const hash = hashSum.digest('hex');
      return { success: true, hash };
    } catch (error) {
      console.error('Failed to calculate file hash:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Dashboard IPC handlers
  ipcMain.handle('get-upload-summary', async (_, { days }: { days: number }) => {
    try {
      const db = await initializeDatabase();
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const result: Array<{ date: string; uploaded: number; deleted: number }> = [];

      // Generate array of dates
      for (let i = 0; i < days; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        const dateStr = currentDate.toISOString().split('T')[0];

        // Count uploads (createdAt matches this date)
        const uploadCount = await new Promise<number>((resolve, reject) => {
          db.get(
            `SELECT COUNT(*) as count FROM images
             WHERE date(createdAt) = ? AND deletedAt IS NULL`,
            [dateStr],
            (err: Error | null, row: any) => {
              if (err) reject(err);
              else resolve(row?.count || 0);
            }
          );
        });

        // Count deletes
        const deleteCount = await new Promise<number>((resolve, reject) => {
          db.get(
            `SELECT COUNT(*) as count FROM images
             WHERE date(deletedAt) = ?`,
            [dateStr],
            (err: Error | null, row: any) => {
              if (err) reject(err);
              else resolve(row?.count || 0);
            }
          );
        });

        result.push({
          date: currentDate.toISOString(),
          uploaded: uploadCount,
          deleted: deleteCount,
        });
      }

      return result;
    } catch (error) {
      console.error('Failed to get upload summary:', error);
      return [];
    }
  });

  ipcMain.handle('get-format-stats', async () => {
    try {
      const db = await initializeDatabase();

      const rows = await new Promise<Array<{ format: string; count: number }>>((resolve, reject) => {
        db.all(
          `SELECT format, COUNT(*) as count
           FROM images
           WHERE deletedAt IS NULL
           GROUP BY format`,
          (err: Error | null, rows: any[]) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      return rows;
    } catch (error) {
      console.error('Failed to get format stats:', error);
      return [];
    }
  });

  ipcMain.handle('get-image-stats', async () => {
    try {
      const db = await initializeDatabase();

      const stats = await new Promise<{ totalCount: number; totalSize: number }>((resolve, reject) => {
        db.get(
          `SELECT COUNT(*) as totalCount, COALESCE(SUM(fileSize), 0) as totalSize
           FROM images
           WHERE deletedAt IS NULL`,
          (err: Error | null, row: any) => {
            if (err) reject(err);
            else resolve({
              totalCount: row?.totalCount || 0,
              totalSize: row?.totalSize || 0,
            });
          }
        );
      });

      return stats;
    } catch (error) {
      console.error('Failed to get image stats:', error);
      return { totalCount: 0, totalSize: 0 };
    }
  });

  ipcMain.handle('get-sync-status', async () => {
    try {
      const db = await initializeDatabase();

      // Get sync metadata
      const metadata = await new Promise<{ lastSyncSequence: number; lastSyncTime: string | null }>((resolve, reject) => {
        db.all(
          `SELECT key, value FROM sync_metadata WHERE key IN ('lastSyncSequence', 'lastSyncTime')`,
          (err: Error | null, rows: any[]) => {
            if (err) reject(err);
            else {
              const result: any = {};
              rows.forEach((row) => {
                if (row.key === 'lastSyncSequence') {
                  result.lastSyncSequence = parseInt(row.value) || 0;
                } else if (row.key === 'lastSyncTime') {
                  result.lastSyncTime = row.value || null;
                }
              });
              resolve(result);
            }
          }
        );
      });

      return {
        localSequence: metadata.lastSyncSequence || 0,
        remoteSequence: metadata.lastSyncSequence || 0, 
        isInSync: true,
        lastSyncTime: metadata.lastSyncTime,
      };
    } catch (error) {
      console.error('Failed to get sync status:', error);
      return {
        localSequence: 0,
        remoteSequence: 0,
        isInSync: false,
        lastSyncTime: null,
      };
    }
  });


  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}




app.whenReady().then(async () => {

  // Protocol for full-size images: local-image://{uuid}.{format}
  protocol.handle('local-image', (request) => {
    try {
      let fileNameWithExt = request.url.slice('local-image://'.length);
      if (fileNameWithExt.endsWith('/')) {
        fileNameWithExt = fileNameWithExt.slice(0, -1);
      }



      const fileName = decodeURIComponent(fileNameWithExt);

      // Build path: {AppData}/image-management/images/{uuid}.{format}
      const filePath = path.join(
        app.getPath('appData'),
        'image-management',
        'images',
        fileName
      );

      return net.fetch(pathToFileURL(filePath).toString(), {
        bypassCustomProtocolHandlers: true,
      });
    } catch (error) {
      console.error('Local Image Protocol Error:', error);
      return new Response('Failed to load image', { status: 500 });
    }
  });

  // Protocol for thumbnails: local-thumbnail://{uuid}?t={timestamp}
  protocol.handle('local-thumbnail', (request) => {
    try {
      let uuid = request.url.slice('local-thumbnail://'.length);

      const queryIndex = uuid.indexOf('?');
      if (queryIndex !== -1) {
        uuid = uuid.substring(0, queryIndex);
      }

      if (uuid.endsWith('/')) {
        uuid = uuid.slice(0, -1);
      }

      const decodedUuid = decodeURIComponent(uuid);

      // Build path: {AppData}/image-management/thumbnails/{uuid}.jpg
      const filePath = path.join(
        app.getPath('appData'),
        'image-management',
        'thumbnails',
        `${decodedUuid}.jpeg`
      );

      return net.fetch(pathToFileURL(filePath).toString(), {
        bypassCustomProtocolHandlers: true,
      });
    } catch (error) {
      console.error('Local Thumbnail Protocol Error:', error);
      return new Response('Failed to load thumbnail', { status: 500 });
    }
  });



  createWindow()




  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    closeDatabase()
    app.quit()
  }
})

app.on('before-quit', () => {
  closeDatabase()
})
