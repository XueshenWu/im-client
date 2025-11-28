/**
 * Utility functions for normalizing file format extensions
 *
 * Standards:
 * - JPEG files: Always use 'jpeg' (not 'jpg')
 * - TIFF files: Always use 'tiff' (not 'tif')
 * - Other formats: Use as-is
 */

export type NormalizedFormat = 'jpeg' | 'png' | 'tiff';

/**
 * Normalize a file format extension to the standard format
 * @param format - The format extension (e.g., 'jpg', 'jpeg', 'tif', 'tiff', 'png')
 * @returns The normalized format extension
 */
export function normalizeFormat(format: string): NormalizedFormat {
  const normalized = format.toLowerCase().replace(/^\./, ''); // Remove leading dot and lowercase

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
      // Fallback for unknown formats - assume jpeg
      return 'jpeg';
  }
}

/**
 * Extract and normalize format from a MIME type
 * @param mimeType - The MIME type (e.g., 'image/jpeg', 'image/tiff')
 * @returns The normalized format extension
 */
export function normalizeFormatFromMimeType(mimeType: string): NormalizedFormat {
  const format = mimeType.split('/')[1] || 'jpeg';
  return normalizeFormat(format);
}

/**
 * Extract and normalize format from a filename
 * @param filename - The filename (e.g., 'photo.jpg', 'scan.tif')
 * @returns The normalized format extension
 */
export function normalizeFormatFromFilename(filename: string): NormalizedFormat {
  const ext = filename.split('.').pop()?.toLowerCase() || 'jpeg';
  return normalizeFormat(ext);
}
