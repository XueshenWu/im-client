import { app, BrowserWindow, ipcMain, dialog, protocol, net, shell } from 'electron'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import si from 'systeminformation'
import crypto from 'crypto'
import installExtension, { REACT_DEVELOPER_TOOLS } from 'electron-devtools-assembler';


// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url)

const __dirname = path.dirname(__filename)

const __FILE_PREFIX = path.join(app.getPath('appData'), 'image-management');

import fs from 'fs/promises'
import { initializeDatabase, dbOperations, closeDatabase } from './database.js'


// Helper to validate files
const isImage = (filename: string) => {
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(filename);
};

// Helper to validate all supported file types (images, zip, json)
const isValidFile = (filename: string) => {
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg|zip|json)$/i.test(filename);
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
    },
  })

  // Set Content Security Policy to allow API connections
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:* http://192.168.0.24:*; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:8097; " +
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
          "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
          "img-src 'self' data: blob: local-image: http://localhost:* http://127.0.0.1:* https: http://192.168.0.24:*; " +
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

  // Set window title
  ipcMain.on('set-window-title', (_event, title: string) => {
    mainWindow.setTitle(title)
  })

  // Updated Handler
  ipcMain.handle('expand-path', async (event, targetPath, recursive = false) => {
    try {
      const stats = await fs.stat(targetPath);

      if (stats.isDirectory()) {
        // Existing logic for folders
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
      // Security Check: Ensure it's actually a string
      if (typeof filePath !== 'string') {
        console.error('Invalid path received');
        return null;
      }

      // Read the file from disk using Node.js
      const buffer = await fs.readFile(filePath);
      return buffer;
    } catch (error) {
      console.error('Failed to read file:', filePath, error);
      return null;
    }
  });

  ipcMain.handle('get-roam-path', () => {
    return path.join(app.getPath('appData'), 'image-management');
  });

  ipcMain.handle('save-thumbnails-to-local', async (event, filePaths: string[]) => {
    try {
      // Get AppData directory for this app
      const appDataPath = path.join(app.getPath('appData'), 'image-management', 'thumbnails');

      // Ensure the directory exists
      await fs.mkdir(appDataPath, { recursive: true });

      const savedFiles: string[] = [];

      for (const filePath of filePaths) {
        try {
          const fileName = path.basename(filePath);
          const destPath = path.join(appDataPath, fileName);

          // Copy file to AppData
          await fs.copyFile(filePath, destPath);
          savedFiles.push(destPath);
        } catch (error) {
          console.error(`Failed to save thumbnail ${filePath}:`, error);
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






  ipcMain.handle('save-files-to-local', async (event, filePaths: string[]) => {
    try {
      // Get AppData directory for this app
      const appDataPath = path.join(app.getPath('appData'), 'image-management', 'images');

      // Ensure the directory exists
      await fs.mkdir(appDataPath, { recursive: true });

      const savedFiles: string[] = [];

      for (const filePath of filePaths) {
        try {
          const fileName = path.basename(filePath);
          const destPath = path.join(appDataPath, fileName);

          // Copy file to AppData
          await fs.copyFile(filePath, destPath);
          savedFiles.push(destPath);
        } catch (error) {
          console.error(`Failed to save file ${filePath}:`, error);
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

      // Ensure the directory exists
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

      // Sort by creation date (newest first)
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
      // 1. Get Hardware UUID (Motherboard/System UUID)
      const systemData = await si.uuid();
      const rawId = systemData.os || systemData.hardware;

      // 2. Hash it for privacy and format consistency
      // Result looks like a UUID: "a1b2c3d4..."
      return crypto.createHash('sha256').update(rawId + 'my-salt').digest('hex');
    } catch (error) {
      console.error('Hardware ID failed, falling back to random UUID', error);
      return crypto.randomUUID();
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

  // Save downloaded image buffer to AppData
  ipcMain.handle('save-image-buffer', async (event, fileName: string, buffer: ArrayBuffer) => {
    try {
      const appDataPath = path.join(app.getPath('appData'), 'image-management', 'images');
      await fs.mkdir(appDataPath, { recursive: true });

      const filePath = path.join(appDataPath, fileName);
      await fs.writeFile(filePath, Buffer.from(buffer));

      return filePath;
    } catch (error) {
      console.error('Failed to save image buffer:', error);
      return null;
    }
  });

  // Save downloaded thumbnail buffer to AppData
  ipcMain.handle('save-thumbnail-buffer', async (event, fileName: string, buffer: ArrayBuffer) => {
    try {
      const appDataPath = path.join(app.getPath('appData'), 'image-management', 'thumbnails');
      await fs.mkdir(appDataPath, { recursive: true });

      const filePath = path.join(appDataPath, fileName);
      await fs.writeFile(filePath, Buffer.from(buffer));

      return filePath;
    } catch (error) {
      console.error('Failed to save thumbnail buffer:', error);
      return null;
    }
  });


  


  ipcMain.handle('dialog:open', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select Images',
      defaultPath: app.getPath('pictures'), // Optional: Start in Pictures folder
      properties: [
        'openFile',        // ✅ Priority: Select Files
        'multiSelections', // ✅ Allow picking multiple
        // 'openDirectory' // ❌ REMOVE THIS to make files visible again on Windows
      ],
      filters: [
        { name: 'Supported Files', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'zip', 'json'] }
      ]
    });

    if (canceled) {
      return [];
    } else {
      return filePaths;
    }
  });

  // ========== Database IPC Handlers ==========
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

  ipcMain.handle('db:getImagePathByUUIDs', async (event, uuids: string[]) => {
    try {
      return dbOperations.getImagePathByUUIDs(uuids);
    } catch (error) {
      console.error('Failed to get image paths by UUIDs:', error);
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
      await dbOperations.deleteImage(uuid);
      const paths = await dbOperations.getImagePathByUUIDs([uuid]);
      if (!paths || paths.length === 0) {
        return { success: true };
      }

      await shell.trashItem(paths[0].filePath);
      await shell.trashItem(paths[0].thumbnailPath);

      return { success: true };
    } catch (error) {
      console.error('Failed to delete image:', error);
      throw error;
    }
  });

  ipcMain.handle('db:deleteImages', async (_, uuids: string[]) => {
    try {
      await dbOperations.deleteImages(uuids);
      const paths = await dbOperations.getImagePathByUUIDs(uuids);

      if (paths) {
        await Promise.allSettled(paths.flatMap(({ filePath, thumbnailPath }) => {
          return [
            shell.trashItem(filePath),
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
      return { lastSyncSequence: 0, lastSyncTime: null };
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

  // Export images to a directory
  ipcMain.handle('export-images', async (event, images: Array<{ uuid: string, filePath: string, filename: string }>, destination: string) => {
    try {
      await fs.mkdir(destination, { recursive: true });

      const results = [];
      for (const image of images) {
        try {
          const destPath = path.join(destination, image.filename);
          await fs.copyFile(image.filePath, destPath);
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
  ipcMain.handle('generate-thumbnail', async (_event, sourcePath: string) => {
    try {
      // Use canvas-based thumbnail generation instead of sharp
      const appDataPath = path.join(app.getPath('appData'), 'image-management', 'thumbnails');
      await fs.mkdir(appDataPath, { recursive: true });

      const fileName = path.basename(sourcePath);
      const thumbnailFileName = `thumb_${fileName}`;
      const thumbnailPath = path.join(appDataPath, thumbnailFileName);

      // Read the original image
      const imageBuffer = await fs.readFile(sourcePath);

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

  // In development mode, load from Vite dev server
  // In production, load from built files
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(async () => {




  protocol.handle('local-image', (request) => {
    try {
      // 1. Get the path part of the URL
      // request.url will look like: "local-image:///C:/Users/name/..."
      // The substring(13) strips "local-image://" leaving "/C:/Users/..."
      let filePath = request.url.slice('local-image://'.length);

      // 2. Decode characters (like %20 for spaces)
      filePath = decodeURIComponent(filePath);

      // 3. Clean up the path for Windows
      // The browser URL path usually starts with a slash, e.g., "/C:/Users/..."
      // pathToFileURL expects "C:/Users/..." on Windows, so we remove the leading slash.
      if (process.platform === 'win32' && filePath.startsWith('/') && filePath.includes(':')) {
        filePath = filePath.slice(1);
      }

      // 4. Create the secure file:// URL and fetch
      // pathToFileURL handles all remaining slash/backslash conversions
      return net.fetch(pathToFileURL(filePath).toString());

    } catch (error) {
      console.error('Local Image Protocol Error:', error);
      // Return a 500 response so the renderer knows it failed
      return new Response('Failed to load image', { status: 500 });
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
