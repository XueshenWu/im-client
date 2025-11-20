import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

import fs from 'fs/promises'


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
          "connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
          "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
          "img-src 'self' data: blob: http://localhost:* http://127.0.0.1:* https:; " +
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

  // In development mode, load from Vite dev server
  // In production, load from built files
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
