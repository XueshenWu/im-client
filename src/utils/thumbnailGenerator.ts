/**
 * Utility for generating thumbnails from images
 */

export interface ThumbnailResult {
  success: boolean;
  thumbnailPath?: string;
  width?: number;
  height?: number;
  error?: string;
}

/**
 * Generate a thumbnail from an image file
 * Uses canvas to resize the image and saves it via Electron API
 */
export async function generateThumbnail(
  sourcePath: string,
  maxWidth: number = 300
): Promise<ThumbnailResult> {
  try {
    if (!window.electronAPI?.generateThumbnail) {
      throw new Error('Electron API not available');
    }

    // Get image buffer from Electron
    const result = await window.electronAPI.generateThumbnail(sourcePath);

    if (!result.success || !result.imageBuffer || !result.thumbnailPath) {
      return {
        success: false,
        error: result.error || 'Failed to prepare thumbnail',
      };
    }

    // Convert number array back to Uint8Array
    const imageBuffer = new Uint8Array(result.imageBuffer);
    const blob = new Blob([imageBuffer]);
    const imageUrl = URL.createObjectURL(blob);

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
      URL.revokeObjectURL(imageUrl);
      throw new Error('Failed to get canvas context');
    }

    ctx.drawImage(img, 0, 0, thumbnailWidth, thumbnailHeight);
    URL.revokeObjectURL(imageUrl);

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
 * Generate thumbnails for multiple images
 */
export async function generateThumbnails(
  sourcePaths: string[],
  maxWidth: number = 300,
  onProgress?: (completed: number, total: number) => void
): Promise<Map<string, ThumbnailResult>> {
  const results = new Map<string, ThumbnailResult>();
  let completed = 0;

  for (const sourcePath of sourcePaths) {
    const result = await generateThumbnail(sourcePath, maxWidth);
    results.set(sourcePath, result);

    completed++;
    onProgress?.(completed, sourcePaths.length);
  }

  return results;
}
