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
import { ExifData, ExifExtra } from '@/types/api';

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
    `${uuid}.jpeg`
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
      pageCount INTEGER DEFAULT 1,
      tiffDimensions TEXT
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

  await run(`CREATE TABLE IF NOT EXISTS exif_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- SQLite does not have a native UUID type; we store it as TEXT.
    uuid TEXT NOT NULL UNIQUE,

    camera_make TEXT,
    camera_model TEXT,
    lens_model TEXT,

    artist TEXT,
    copyright TEXT,
    software TEXT,

    iso INTEGER,

    shutter_speed TEXT,
    aperture TEXT,
    focal_length TEXT,

    -- SQLite typically stores dates as ISO8601 Strings (TEXT) or Unix Epochs (INTEGER).
    -- TEXT is recommended for readability and compatibility with ISO strings.
    date_taken TEXT,

    orientation INTEGER DEFAULT 1,

    -- SQLite uses REAL (Floating Point) or NUMERIC for decimals.
    gps_latitude NUMERIC,
    gps_longitude NUMERIC,
    gps_altitude NUMERIC,

    -- SQLite does not have JSONB. We store JSON as plain TEXT.
    -- You can still query it using SQLite's json_extract() function if needed.
    extra TEXT
);`)

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
 * Helper to parse image data from database
 */
function parseImageData(row: any): any {
  if (!row) return row;

  // Parse tiffDimensions from JSON string if present
  if (row.tiffDimensions && typeof row.tiffDimensions === 'string') {
    try {
      row.tiffDimensions = JSON.parse(row.tiffDimensions);
    } catch (error) {
      console.error('[DB] Failed to parse tiffDimensions:', error);
      row.tiffDimensions = null;
    }
  }

  return row;
}

/**
 * Database operations
 */
export const dbOperations = {
  async getAllImages(): Promise<any[]> {
    const images = await sql.all('SELECT * FROM images WHERE deletedAt IS NULL ORDER BY createdAt DESC');
    return images.map(parseImageData);
  },

  async getImageByUuid(uuid: string): Promise<any | undefined> {
    const image = await sql.get('SELECT * FROM images WHERE uuid = ? AND deletedAt IS NULL', [uuid]);
    return parseImageData(image);
  },

  async getExifDataByUuid(uuid: string): Promise<ExifData | null> {
    const row = await sql.get('SELECT * FROM exif_data WHERE uuid = ?', [uuid]);

    if (!row) return null;

    // Parse extra field if it exists
    let extra: ExifExtra | undefined = undefined;
    if (row.extra && typeof row.extra === 'string') {
      try {
        extra = JSON.parse(row.extra);
      } catch (error) {
        console.error('[DB] Failed to parse EXIF extra data:', error);
      }
    }

    return {
      cameraMake: row.camera_make || undefined,
      cameraModel: row.camera_model || undefined,
      lensModel: row.lens_model || undefined,
      artist: row.artist || undefined,
      copyright: row.copyright || undefined,
      software: row.software || undefined,
      iso: row.iso || undefined,
      shutterSpeed: row.shutter_speed || undefined,
      aperture: row.aperture || undefined,
      focalLength: row.focal_length || undefined,
      dateTaken: row.date_taken || undefined,
      orientation: row.orientation || undefined,
      gpsLatitude: row.gps_latitude?.toString() || undefined,
      gpsLongitude: row.gps_longitude?.toString() || undefined,
      gpsAltitude: row.gps_altitude?.toString() || undefined,
      extra,
    };
  },

  async upsertExifData(uuid: string, exifData: ExifData): Promise<{ id: number; changes: number }> {
    // Helper to convert GPS string values to numbers for NUMERIC fields
    const parseGpsValue = (value: string | null | undefined): number | null => {
      if (value === null || value === undefined) return null;
      const parsed = parseFloat(value);
      return isNaN(parsed) ? null : parsed;
    };

    const bindData: any = {
      $uuid: uuid,
      $camera_make: exifData.cameraMake ?? null,
      $camera_model: exifData.cameraModel ?? null,
      $lens_model: exifData.lensModel ?? null,
      $artist: exifData.artist ?? null,
      $copyright: exifData.copyright ?? null,
      $software: exifData.software ?? null,
      $iso: exifData.iso ?? null,
      $shutter_speed: exifData.shutterSpeed ?? null,
      $aperture: exifData.aperture ?? null,
      $focal_length: exifData.focalLength ?? null,
      $date_taken: exifData.dateTaken ?? null,
      $orientation: exifData.orientation ?? null,
      $gps_latitude: parseGpsValue(exifData.gpsLatitude),
      $gps_longitude: parseGpsValue(exifData.gpsLongitude),
      $gps_altitude: parseGpsValue(exifData.gpsAltitude),
      $extra: exifData.extra ? JSON.stringify(exifData.extra) : null,
    };

    return await sql.run(`
      INSERT OR REPLACE INTO exif_data (
        uuid, camera_make, camera_model, lens_model,
        artist, copyright, software,
        iso, shutter_speed, aperture, focal_length,
        date_taken, orientation,
        gps_latitude, gps_longitude, gps_altitude,
        extra
      ) VALUES (
        $uuid, $camera_make, $camera_model, $lens_model,
        $artist, $copyright, $software,
        $iso, $shutter_speed, $aperture, $focal_length,
        $date_taken, $orientation,
        $gps_latitude, $gps_longitude, $gps_altitude,
        $extra
      )
    `, bindData);
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

    return { images: images.map(parseImageData), total };
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
    Object.keys(image).forEach(k => {
      if (k === 'exifData') {
        // Skip exifData - it goes to separate table
        return;
      }
      if (k === 'tiffDimensions' && image[k]) {
        // Serialize tiffDimensions to JSON string
        bindData['$' + k] = JSON.stringify(image[k]);
      } else {
        bindData['$' + k] = image[k];
      }
    });

    const result = await sql.run(`
      INSERT INTO images (
        uuid, filename, fileSize, format,
        width, height, hash, mimeType, isCorrupted, createdAt, updatedAt, deletedAt, pageCount, tiffDimensions
      ) VALUES (
        $uuid, $filename, $fileSize, $format,
        $width, $height, $hash, $mimeType, $isCorrupted, $createdAt, $updatedAt, $deletedAt, $pageCount, $tiffDimensions
      )
    `, bindData);

    // If exifData exists, insert into exif_data table
    if (image.exifData) {
      try {
        await this.insertExifData(image.uuid, image.exifData);
      } catch (error) {
        console.error('[DB] Failed to insert EXIF data:', error);
        // Don't fail the entire operation if EXIF insert fails
      }
    }

    return { ...image, id: result.id };
  },

  async insertExifData(uuid: string, exifData: any): Promise<void> {
    // Helper to convert GPS string values to numbers for NUMERIC fields
    const parseGpsValue = (value: string | null | undefined): number | null => {
      if (value === null || value === undefined) return null;
      const parsed = parseFloat(value);
      return isNaN(parsed) ? null : parsed;
    };

    const bindData: any = {
      $uuid: uuid,
      $camera_make: exifData.cameraMake ?? null,
      $camera_model: exifData.cameraModel ?? null,
      $lens_model: exifData.lensModel ?? null,
      $artist: exifData.artist ?? null,
      $copyright: exifData.copyright ?? null,
      $software: exifData.software ?? null,
      $iso: exifData.iso ?? null,
      $shutter_speed: exifData.shutterSpeed ?? null,
      $aperture: exifData.aperture ?? null,
      $focal_length: exifData.focalLength ?? null,
      $date_taken: exifData.dateTaken ?? null,
      $orientation: exifData.orientation ?? null,
      $gps_latitude: parseGpsValue(exifData.gpsLatitude),
      $gps_longitude: parseGpsValue(exifData.gpsLongitude),
      $gps_altitude: parseGpsValue(exifData.gpsAltitude),
      $extra: exifData.extra ? JSON.stringify(exifData.extra) : null,
    };

    await sql.run(`
      INSERT OR REPLACE INTO exif_data (
        uuid, camera_make, camera_model, lens_model,
        artist, copyright, software,
        iso, shutter_speed, aperture, focal_length,
        date_taken, orientation,
        gps_latitude, gps_longitude, gps_altitude,
        extra
      ) VALUES (
        $uuid, $camera_make, $camera_model, $lens_model,
        $artist, $copyright, $software,
        $iso, $shutter_speed, $aperture, $focal_length,
        $date_taken, $orientation,
        $gps_latitude, $gps_longitude, $gps_altitude,
        $extra
      )
    `, bindData);
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

        const imageStmt = db.prepare(`
          INSERT INTO images (
            uuid, filename, fileSize, format,
            width, height, hash, mimeType, isCorrupted, createdAt, updatedAt, deletedAt, pageCount, tiffDimensions
          ) VALUES (
            $uuid, $filename, $fileSize, $format,
            $width, $height, $hash, $mimeType, $isCorrupted, $createdAt, $updatedAt, $deletedAt, $pageCount, $tiffDimensions
          )
        `);

        const exifStmt = db.prepare(`
          INSERT OR REPLACE INTO exif_data (
            uuid, camera_make, camera_model, lens_model,
            artist, copyright, software,
            iso, shutter_speed, aperture, focal_length,
            date_taken, orientation,
            gps_latitude, gps_longitude, gps_altitude,
            extra
          ) VALUES (
            $uuid, $camera_make, $camera_model, $lens_model,
            $artist, $copyright, $software,
            $iso, $shutter_speed, $aperture, $focal_length,
            $date_taken, $orientation,
            $gps_latitude, $gps_longitude, $gps_altitude,
            $extra
          )
        `);

        images.forEach(img => {
          const bindData: any = {};
          Object.keys(img).forEach(k => {
            if (k === 'exifData') {
              // Skip exifData - it goes to separate table
              return;
            }
            if (k === 'tiffDimensions' && img[k]) {
              // Serialize tiffDimensions to JSON string
              bindData['$' + k] = JSON.stringify(img[k]);
            } else {
              bindData['$' + k] = img[k];
            }
          });

          imageStmt.run(bindData, function (this: any, err: Error | null) {
            if (err) {
              console.error('Error inserting image in transaction:', err);
            } else {
              results.push({ ...img, id: this.lastID });
            }
          });

          // Insert EXIF data if available
          if (img.exifData) {
            // Helper to convert GPS string values to numbers for NUMERIC fields
            const parseGpsValue = (value: string | null | undefined): number | null => {
              if (value === null || value === undefined) return null;
              const parsed = parseFloat(value);
              return isNaN(parsed) ? null : parsed;
            };

            const exifBindData: any = {
              $uuid: img.uuid,
              $camera_make: img.exifData.cameraMake ?? null,
              $camera_model: img.exifData.cameraModel ?? null,
              $lens_model: img.exifData.lensModel ?? null,
              $artist: img.exifData.artist ?? null,
              $copyright: img.exifData.copyright ?? null,
              $software: img.exifData.software ?? null,
              $iso: img.exifData.iso ?? null,
              $shutter_speed: img.exifData.shutterSpeed ?? null,
              $aperture: img.exifData.aperture ?? null,
              $focal_length: img.exifData.focalLength ?? null,
              $date_taken: img.exifData.dateTaken ?? null,
              $orientation: img.exifData.orientation ?? null,
              $gps_latitude: parseGpsValue(img.exifData.gpsLatitude),
              $gps_longitude: parseGpsValue(img.exifData.gpsLongitude),
              $gps_altitude: parseGpsValue(img.exifData.gpsAltitude),
              $extra: img.exifData.extra ? JSON.stringify(img.exifData.extra) : null,
            };

            exifStmt.run(exifBindData, (err: Error | null) => {
              if (err) {
                console.error('Error inserting EXIF data in transaction:', err);
              }
            });
          }
        });

        imageStmt.finalize();
        exifStmt.finalize();

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

  /**
   * Get all images with their EXIF data for LWW sync diff calculation
   * Joins images and exif_data tables
   */
  async getAllImagesWithExif(): Promise<any[]> {
    const images = await sql.all(`
      SELECT
        i.*,
        e.camera_make,
        e.camera_model,
        e.lens_model,
        e.artist,
        e.copyright,
        e.software,
        e.iso,
        e.shutter_speed,
        e.aperture,
        e.focal_length,
        e.date_taken,
        e.orientation,
        e.gps_latitude,
        e.gps_longitude,
        e.gps_altitude,
        e.extra
      FROM images i
      LEFT JOIN exif_data e ON i.uuid = e.uuid
      ORDER BY i.createdAt DESC
    `);

    return images.map((row: any) => {
      const image = parseImageData(row);

      // Build exifData object if any EXIF fields exist
      const hasExifData = row.camera_make || row.camera_model || row.lens_model ||
                         row.artist || row.copyright || row.software || row.iso ||
                         row.shutter_speed || row.aperture || row.focal_length ||
                         row.date_taken || row.orientation || row.gps_latitude ||
                         row.gps_longitude || row.gps_altitude || row.extra;

      if (hasExifData) {
        // Parse extra field if it exists
        let extra: ExifExtra | undefined = undefined;
        if (row.extra && typeof row.extra === 'string') {
          try {
            extra = JSON.parse(row.extra);
          } catch (error) {
            console.error('[DB] Failed to parse EXIF extra data:', error);
          }
        }

        image.exifData = {
          cameraMake: row.camera_make || undefined,
          cameraModel: row.camera_model || undefined,
          lensModel: row.lens_model || undefined,
          artist: row.artist || undefined,
          copyright: row.copyright || undefined,
          software: row.software || undefined,
          iso: row.iso || undefined,
          shutterSpeed: row.shutter_speed || undefined,
          aperture: row.aperture || undefined,
          focalLength: row.focal_length || undefined,
          dateTaken: row.date_taken || undefined,
          orientation: row.orientation || undefined,
          gpsLatitude: row.gps_latitude?.toString() || undefined,
          gpsLongitude: row.gps_longitude?.toString() || undefined,
          gpsAltitude: row.gps_altitude?.toString() || undefined,
          extra,
        };
      }

      return image;
    });
  },
};