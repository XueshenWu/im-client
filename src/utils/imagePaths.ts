/**
 * Utility functions for generating image URLs
 *
 * Local mode:
 * - local-image://{uuid}.{format} - for full-size images
 * - local-thumbnail://{uuid} - for thumbnails (always .jpg)
 *
 * Cloud mode:
 * - Thumbnails: {API_URL}/storage/thumbnails/{uuid}.{ext} - public
 * - Images: Request presigned URL from server
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Get the display URL for a full-size local image
 */
export function getLocalImageUrl(uuid: string, format: string): string {
  return `local-image://${uuid}.${format}`;
}

/**
 * Get the display URL for a local thumbnail
 */
export function getLocalThumbnailUrl(uuid: string): string {
  return `local-thumbnail://${uuid}`;
}

/**
 * Get the public URL for a cloud thumbnail
 * Cloud thumbnails are publicly accessible from MinIO
 */
export function getCloudThumbnailUrl(uuid: string, format: string): string {
  return `${API_BASE_URL}/storage/thumbnails/${uuid}.${format}?t=${new Date().getTime()}}`;
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
