import { app } from 'electron';
import path from 'path';
import { mkdirSync } from 'fs';
import { createRequire } from 'module';

// FIX: Native modules like sqlite3 cannot be bundled by Vite/Webpack.
// We must use 'createRequire' to load them dynamically at runtime from node_modules.
const require = createRequire(import.meta.url);
const sqlite3 = require('sqlite3').verbose();

// Use the type from the import for TypeScript, but the runtime value from require
import type { Database } from 'sqlite3';

let db: Database | null = null;

/**
 * Helper functions for UUID-based file path resolution
 */
export function getImagePath(uuid: string, format: string): string {
  return path.join(
    app.getPath('appData'),
    'image-management',
    'images',
    `${uuid}.${format}`
  );
}

export function getThumbnailPath(uuid: string): string {
  return path.join(
    app.getPath('appData'),
    'image-management',
    'thumbnails',
    `${uuid}.jpg`
  );
}

/**
 * Initialize the SQLite database
 */
export async function initializeDatabase(): Promise<Database> {
  if (db) return db;

  const dbPath = path.join(app.getPath('appData'), 'image-management', 'local.db');
  const dbDir = path.dirname(dbPath);

  try {
    mkdirSync(dbDir, { recursive: true });
  } catch (error) {
    console.error('Failed to create database directory:', error);
  }

  console.log('[DB] Initializing sqlite3 database at:', dbPath);

  return new Promise((resolve, reject) => {
    // sqlite3.Database signature matches the required type
    db = new sqlite3.Database(dbPath, (err: Error | null) => {
      if (err) {
        console.error('[DB] Critical Error opening DB:', err);
        reject(err);
        return;
      }

      console.log('[DB] Database opened successfully');

      // Enable WAL mode
      db?.run('PRAGMA journal_mode = WAL', (err: Error | null) => {
        if (err) console.error('[DB] Failed to set WAL mode:', err);
      });

      // Create tables
      if (db) {
        createTables(db)
          .then(() => resolve(db!))
          .catch(reject);
      }
    });
  });
}

/**
 * Create database tables
 */
async function createTables(database: Database): Promise<void> {
  const run = (sql: string) => new Promise<void>((resolve, reject) => {
    database.run(sql, (err: Error | null) => err ? reject(err) : resolve());
  });

  await run(`
    CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      filename TEXT NOT NULL,
      fileSize INTEGER NOT NULL,
      format TEXT NOT NULL,
      width INTEGER NOT NULL DEFAULT 0,
      height INTEGER NOT NULL DEFAULT 0,
      hash TEXT NOT NULL DEFAULT '',
      mimeType TEXT NOT NULL,
      isCorrupted INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      deletedAt TEXT,
      exifData TEXT
    );
  `);

  await run(`CREATE INDEX IF NOT EXISTS idx_images_uuid ON images(uuid);`);
  await run(`CREATE INDEX IF NOT EXISTS idx_images_filename ON images(filename);`);
  await run(`CREATE INDEX IF NOT EXISTS idx_images_createdAt ON images(createdAt);`);

  await run(`
    CREATE TABLE IF NOT EXISTS sync_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Initialize sync metadata
  await run(`INSERT OR IGNORE INTO sync_metadata (key, value) VALUES ('lastSyncSequence', '0')`);
  await run(`INSERT OR IGNORE INTO sync_metadata (key, value) VALUES ('lastSyncTime', '')`);

  console.log('[DB] Tables created successfully');
}

/**
 * Get the database instance
 */
export function getDatabase(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

/**
 * Close the database connection
 */
export function closeDatabase() {
  if (db) {
    db.close((err: Error | null) => {
      if (err) console.error('[DB] Error closing database:', err);
      else console.log('[DB] Database closed');
    });
    db = null;
  }
}

/**
 * Helper to wrap sqlite3 methods in Promises
 */
const sql = {
  all: (sql: string, params: any[] | any = []) => {
    const db = getDatabase();
    return new Promise<any[]>((resolve, reject) => {
      db.all(sql, params, (err: Error | null, rows: any[]) => err ? reject(err) : resolve(rows));
    });
  },
  get: (sql: string, params: any[] | any = []) => {
    const db = getDatabase();
    return new Promise<any>((resolve, reject) => {
      db.get(sql, params, (err: Error | null, row: any) => err ? reject(err) : resolve(row));
    });
  },
  run: (sql: string, params: any[] | any = []) => {
    const db = getDatabase();
    return new Promise<{ id: number; changes: number }>((resolve, reject) => {
      // Intentionally using function() to access 'this'
      db.run(sql, params, function (this: any, err: Error | null) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }
};

/**
 * Database operations
 */
export const dbOperations = {
  async getAllImages(): Promise<any[]> {
    return sql.all('SELECT * FROM images WHERE deletedAt IS NULL ORDER BY createdAt DESC');
  },

  async getImageByUuid(uuid: string): Promise<any | undefined> {
    return sql.get('SELECT * FROM images WHERE uuid = ? AND deletedAt IS NULL', [uuid]);
  },

  async getPaginatedImages(
    page: number,
    pageSize: number,
    sortBy?: 'filename' | 'fileSize' | 'format' | 'updatedAt' | 'createdAt',
    sortOrder?: 'asc' | 'desc'
  ): Promise<{ images: any[]; total: number }> {
    const offset = (page - 1) * pageSize;

    const countResult = await sql.get('SELECT COUNT(*) as count FROM images WHERE deletedAt IS NULL');
    const total = countResult ? countResult.count : 0;

    // Build ORDER BY clause
    const orderByColumn = sortBy || 'createdAt';
    const orderDirection = sortOrder || 'desc';
    const orderBy = `${orderByColumn} ${orderDirection.toUpperCase()}`;

    const images = await sql.all(
      `SELECT * FROM images WHERE deletedAt IS NULL ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [pageSize, offset]
    );

    return { images, total };
  },

  async getImageFormatByUUIDs(uuids: string[]): Promise<
   {
      uuid: string;
      format: string;
    }[]
  > {
    const rows = await sql.all(
      'SELECT uuid, format FROM images WHERE uuid IN (?) AND deletedAt IS NULL',
      [uuids]
    );

    return rows.map((row: any) => ({
      uuid: row.uuid,
      format: row.format,
    }));
  },

  async insertImage(image: any): Promise<any> {
    const bindData: any = {};
    Object.keys(image).forEach(k => bindData['$' + k] = image[k]);

    const result = await sql.run(`
      INSERT INTO images (
        uuid, filename, fileSize, format,
        width, height, hash, mimeType, isCorrupted, createdAt, updatedAt, deletedAt, exifData
      ) VALUES (
        $uuid, $filename, $fileSize, $format,
        $width, $height, $hash, $mimeType, $isCorrupted, $createdAt, $updatedAt, $deletedAt, $exifData
      )
    `, bindData);

    return { ...image, id: result.id };
  },

  /**
   * Insert multiple images using a manual transaction
   */
  async insertImages(images: any[]): Promise<any[]> {
    const db = getDatabase();
    const results: any[] = [];

    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        const stmt = db.prepare(`
          INSERT INTO images (
            uuid, filename, fileSize, format,
            width, height, hash, mimeType, isCorrupted, createdAt, updatedAt, deletedAt, exifData
          ) VALUES (
            $uuid, $filename, $fileSize, $format,
            $width, $height, $hash, $mimeType, $isCorrupted, $createdAt, $updatedAt, $deletedAt, $exifData
          )
        `);

        images.forEach(img => {
          const bindData: any = {};
          Object.keys(img).forEach(k => bindData['$' + k] = img[k]);

          stmt.run(bindData, function(this: any, err: Error | null) {
            if (err) {
              console.error('Error inserting image in transaction:', err);
            } else {
              results.push({ ...img, id: this.lastID });
            }
          });
        });

        stmt.finalize();

        db.run('COMMIT', (err: Error | null) => {
          if (err) reject(err);
          else resolve(results);
        });
      });
    });
  },

  async updateImage(uuid: string, updates: any): Promise<void> {
    const fields = Object.keys(updates).map((key) => `${key} = $${key}`).join(', ');
    
    const bindData: any = { $uuid: uuid };
    Object.keys(updates).forEach(k => bindData['$' + k] = updates[k]);

    await sql.run(
      `UPDATE images SET ${fields}, updatedAt = datetime('now') WHERE uuid = $uuid`,
      bindData
    );
  },

  async deleteImage(uuid: string): Promise<void> {
    await sql.run('DELETE FROM images WHERE uuid = ?', [uuid]);
  },

  async deleteImages(uuids: string[]): Promise<void> {
    const db = getDatabase();
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        const stmt = db.prepare('DELETE FROM images WHERE uuid = ?');
        uuids.forEach(id => stmt.run(id));
        stmt.finalize();

        db.run('COMMIT', (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  },

  async searchImages(query: string): Promise<any[]> {
    return sql.all(
      'SELECT * FROM images WHERE deletedAt IS NULL AND filename LIKE ? ORDER BY createdAt DESC',
      [`%${query}%`]
    );
  },

  async clearAllImages(): Promise<void> {
    await sql.run('DELETE FROM images');
  },

  async getSyncMetadata(): Promise<{ lastSyncSequence: number; lastSyncTime: string | null }> {
    const rows = await sql.all('SELECT key, value FROM sync_metadata');

    const metadata: any = {};
    rows.forEach((row: any) => {
      if (row.key === 'lastSyncSequence') {
        metadata[row.key] = parseInt(row.value, 10);
      } else {
        metadata[row.key] = row.value || null;
      }
    });

    return {
      lastSyncSequence: metadata.lastSyncSequence || 0,
      lastSyncTime: metadata.lastSyncTime || null,
    };
  },

  async updateSyncMetadata(metadata: { lastSyncSequence?: number; lastSyncTime?: string }): Promise<void> {
    const db = getDatabase();
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        const stmt = db.prepare('INSERT OR REPLACE INTO sync_metadata (key, value) VALUES (?, ?)');
        
        if (metadata.lastSyncSequence !== undefined) {
          stmt.run('lastSyncSequence', metadata.lastSyncSequence.toString());
        }
        if (metadata.lastSyncTime !== undefined) {
          stmt.run('lastSyncTime', metadata.lastSyncTime);
        }
        
        stmt.finalize();
        
        db.run('COMMIT', (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  },
};