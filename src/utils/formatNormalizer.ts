/**
 * - JPEG files: Always use 'jpeg' (not 'jpg')
 * - TIFF files: Always use 'tiff' (not 'tif')
 * - Other formats: Use as-is
 */

export type NormalizedFormat = 'jpeg' | 'png' | 'tiff';


export function normalizeFormat(format: string): NormalizedFormat {
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
      return 'jpeg';
  }
}

export function normalizeFormatFromMimeType(mimeType: string): NormalizedFormat {
  const format = mimeType.split('/')[1] || 'jpeg';
  return normalizeFormat(format);
}

export function normalizeFormatFromFilename(filename: string): NormalizedFormat {
  const ext = filename.split('.').pop()?.toLowerCase() || 'jpeg';
  return normalizeFormat(ext);
}
