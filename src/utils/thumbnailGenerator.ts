/**
 * Utility for generating thumbnails from images
 * Supports both WASM-based (ImageMagick) and Canvas-based thumbnail generation
 * with automatic fallback for compatibility
 */

import { initializeImageMagick, ImageMagick, MagickFormat } from '@imagemagick/magick-wasm';

export interface ThumbnailResult {
  success: boolean;
  thumbnailPath?: string;
  width?: number;
  height?: number;
  error?: string;
}

// WASM initialization state
let wasmInitialized = false;
let wasmInitializationFailed = false;
let wasmInitPromise: Promise<void> | null = null;

/**
 * Initialize ImageMagick WASM module
 * Only initializes once, subsequent calls return cached promise
 */
async function ensureWasmInitialized(): Promise<boolean> {
  // If already failed, don't try again
  if (wasmInitializationFailed) {
    return false;
  }

  // If already initialized, return immediately
  if (wasmInitialized) {
    return true;
  }

  // If initialization is in progress, wait for it
  if (wasmInitPromise) {
    try {
      await wasmInitPromise;
      return wasmInitialized;
    } catch {
      return false;
    }
  }

  // Start new initialization
  wasmInitPromise = (async () => {
    try {
      console.log('[ThumbnailGenerator] Initializing ImageMagick WASM...');

      // Fetch the WASM bytes from the package
      const wasmBytes = await fetch(
        new URL('@imagemagick/magick-wasm/magick.wasm', import.meta.url)
      ).then(response => response.arrayBuffer());

      // Initialize with the WASM bytes
      await initializeImageMagick(new Uint8Array(wasmBytes));
      wasmInitialized = true;
      console.log('[ThumbnailGenerator] ImageMagick WASM initialized successfully');
    } catch (error) {
      console.error('[ThumbnailGenerator] Failed to initialize ImageMagick WASM:', error);
      wasmInitializationFailed = true;
      throw error;
    }
  })();

  try {
    await wasmInitPromise;
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a thumbnail blob using ImageMagick WASM
 * @throws Error if WASM processing fails
 */
async function generateThumbnailBlobWasm(
  file: File | Blob,
  maxWidth: number = 300
): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const inputBuffer = new Uint8Array(arrayBuffer);

  return new Promise((resolve, reject) => {
    try {
      ImageMagick.read(inputBuffer, (img) => {
        try {
          // Calculate thumbnail dimensions maintaining aspect ratio
          const aspectRatio = img.width / img.height;
          const thumbnailWidth = Math.min(maxWidth, img.width);
          const thumbnailHeight = Math.round(thumbnailWidth / aspectRatio);

          // Resize image
          img.resize(thumbnailWidth, thumbnailHeight);

          // Set quality (0.8 = 80%)
          img.quality = 80;

          // Write to JPEG blob
          img.write(MagickFormat.Jpeg, (data) => {
            // Create a new standard Uint8Array to avoid SharedArrayBuffer issues
            const standardArray = new Uint8Array(data);
            const blob = new Blob([standardArray], { type: 'image/jpeg' });
            resolve(blob);
          });
        } catch (err) {
          reject(err);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generate a thumbnail blob using Canvas API (fallback method)
 * This is the original implementation, maintained for backward compatibility
 */
async function generateThumbnailBlobCanvas(
  file: File | Blob,
  maxWidth: number = 300
): Promise<Blob> {
  // Create object URL from the file
  const imageUrl = URL.createObjectURL(file);

  try {
    // Load image into canvas
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageUrl;
    });

    // Calculate thumbnail dimensions
    const aspectRatio = img.width / img.height;
    const thumbnailWidth = Math.min(maxWidth, img.width);
    const thumbnailHeight = Math.round(thumbnailWidth / aspectRatio);

    // Create canvas and draw resized image
    const canvas = document.createElement('canvas');
    canvas.width = thumbnailWidth;
    canvas.height = thumbnailHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    ctx.drawImage(img, 0, 0, thumbnailWidth, thumbnailHeight);

    // Convert canvas to blob
    const thumbnailBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create thumbnail blob'));
        },
        'image/jpeg',
        0.8
      );
    });

    return thumbnailBlob;
  } finally {
    // Clean up object URL
    URL.revokeObjectURL(imageUrl);
  }
}

/**
 * Generate a thumbnail blob from a File or Blob (for cloud upload)
 * This version doesn't save to disk, just returns the blob for upload
 *
 * Automatically uses WASM (ImageMagick) if available, falls back to Canvas if not
 */
export async function generateThumbnailBlob(
  file: File | Blob,
  maxWidth: number = 300
): Promise<Blob> {
  // Try WASM first if available
  const wasmAvailable = await ensureWasmInitialized();

  if (wasmAvailable) {
    try {
      console.log('[ThumbnailGenerator] Using WASM for thumbnail generation');
      const startTime = performance.now();
      const blob = await generateThumbnailBlobWasm(file, maxWidth);
      const endTime = performance.now();
      console.log(`[ThumbnailGenerator] WASM thumbnail generated in ${(endTime - startTime).toFixed(2)}ms`);
      return blob;
    } catch (error) {
      console.warn('[ThumbnailGenerator] WASM thumbnail generation failed, falling back to Canvas:', error);
      // Fall through to Canvas fallback
    }
  } else {
    console.log('[ThumbnailGenerator] WASM not available, using Canvas');
  }

  // Fallback to Canvas
  const startTime = performance.now();
  const blob = await generateThumbnailBlobCanvas(file, maxWidth);
  const endTime = performance.now();
  console.log(`[ThumbnailGenerator] Canvas thumbnail generated in ${(endTime - startTime).toFixed(2)}ms`);
  return blob;
}

/**
 * Generate a thumbnail from an image file
 * Uses WASM (with Canvas fallback) to resize the image and saves it via Electron API
 */
export async function generateThumbnail(
  sourcePath: string,
  uuid: string,
  maxWidth: number = 300
): Promise<ThumbnailResult> {
  try {
    if (!window.electronAPI?.generateThumbnail) {
      throw new Error('Electron API not available');
    }

    // Get image buffer from Electron
    const result = await window.electronAPI.generateThumbnail(sourcePath, uuid);

    if (!result.success || !result.imageBuffer || !result.thumbnailPath) {
      return {
        success: false,
        error: result.error || 'Failed to prepare thumbnail',
      };
    }

    // Convert number array back to Uint8Array and create blob
    const imageBuffer = new Uint8Array(result.imageBuffer);
    const blob = new Blob([imageBuffer]);

    // Generate thumbnail using WASM or Canvas
    const thumbnailBlob = await generateThumbnailBlob(blob, maxWidth);

    // Get dimensions for the result (we need to extract this from the blob)
    let thumbnailWidth = maxWidth;
    let thumbnailHeight = 0;

    // Try to get actual dimensions from the generated thumbnail
    try {
      const thumbnailUrl = URL.createObjectURL(thumbnailBlob);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          thumbnailWidth = img.width;
          thumbnailHeight = img.height;
          resolve();
        };
        img.onerror = () => reject(new Error('Failed to load thumbnail'));
        img.src = thumbnailUrl;
      });
      URL.revokeObjectURL(thumbnailUrl);
    } catch (error) {
      console.warn('[ThumbnailGenerator] Could not extract thumbnail dimensions:', error);
      // Keep default values
    }

    // Convert blob to ArrayBuffer and save via Electron
    const arrayBuffer = await thumbnailBlob.arrayBuffer();
    const saveResult = await window.electronAPI.saveGeneratedThumbnail(
      result.thumbnailPath,
      arrayBuffer
    );

    if (!saveResult.success) {
      return {
        success: false,
        error: saveResult.error || 'Failed to save thumbnail',
      };
    }

    return {
      success: true,
      thumbnailPath: saveResult.thumbnailPath,
      width: thumbnailWidth,
      height: thumbnailHeight,
    };
  } catch (error) {
    console.error('Thumbnail generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Utility function to check if WASM is available
 * Useful for debugging or conditional logic
 */
export async function isWasmAvailable(): Promise<boolean> {
  return await ensureWasmInitialized();
}

/**
 * Force reset WASM initialization state
 * Useful for testing or recovery from errors
 */
export function resetWasmState(): void {
  wasmInitialized = false;
  wasmInitializationFailed = false;
  wasmInitPromise = null;
  console.log('[ThumbnailGenerator] WASM state reset');
}
