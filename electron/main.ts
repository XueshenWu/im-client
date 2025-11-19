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
