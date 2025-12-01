/**
 * Local mode:
 * - local-image://{uuid}.{format} - for full-size images
 * - local-thumbnail://{uuid} - for thumbnails (always .jpeg)
 *
 * Cloud mode:
 * - Thumbnails: {API_URL}/storage/thumbnails/{uuid}.{ext} - public
 * - Images: Request presigned URL from server
 */


const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://192.168.0.24.nip.io:9999';
const STORAGE_BASE_URL = import.meta.env.VITE_STORAGE_URL || 'http://s3.192.168.0.24.nip.io:9999';


// Get the display URL for a full-size local image
export function getLocalImageUrl(uuid: string, format: string): string {
  return `local-image://${uuid}.${format}`;
}

/**
 * Get the display URL for a local thumbnail
 * Includes a cache-busting timestamp to ensure thumbnails refresh when images are replaced
 */
export function getLocalThumbnailUrl(uuid: string): string {
  return `local-thumbnail://${uuid}?t=${new Date().getTime()}`;
}

/**
 * Get the public URL for a cloud thumbnail
 * Cloud thumbnails are publicly accessible from MinIO
 */
export function getCloudThumbnailUrl(uuid: string, _: string): string {
  return `${STORAGE_BASE_URL}/thumbnails/${uuid}.jpeg?t=${new Date().getTime()}}`;
}

/**
 * Get the URL for requesting a presigned URL for a cloud image
 * The actual image file requires a presigned URL from the server
 */
export function getCloudImagePresignedUrlEndpoint(uuid: string): string {
  return `${API_BASE_URL}/api/images/file/uuid/${uuid}`;
}

// Backward compatibility - for local images
export function getImageUrl(uuid: string, format: string): string {
  return getLocalImageUrl(uuid, format);
}

export function getThumbnailUrl(uuid: string): string {
  return getLocalThumbnailUrl(uuid);
}
