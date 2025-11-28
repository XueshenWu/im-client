import api from './api'
import type {
  ApiResponse,
  ApiListResponse,
  Image,
  ImageStats,
  GetImagesParams,
  GetImagesByUUIDResponse,
  PreSignURLsResponse,
  ExifData,
} from '@/types/api'
import exifr from 'exifr'
import { normalizeFormatFromFilename } from '@/utils/formatNormalizer'

/**
 * Extract EXIF data from an image file
 */
export const extractExifData = async (file: File): Promise<ExifData | undefined> => {
  try {
    if (!file.type.startsWith('image/')) {
      return undefined;
    }

    const exif = await exifr.parse(file, {
      pick: [
        'Make', 'Model', 'LensModel',
        'Artist', 'Copyright', 'Software',
        'ISO',
        'ExposureTime', 'FNumber', 'FocalLength',
        'DateTimeOriginal',
        'Orientation',
        'GPSLatitude', 'GPSLongitude', 'GPSAltitude',
        'WhiteBalance', 'Flash', 'ExposureMode', 'MeteringMode', 'ColorSpace'
      ]
    });

    if (!exif) return undefined;

    // Map exifr output to our ExifData type
    const exifData: any = {};

    if (exif.Make) exifData.cameraMake = exif.Make;
    if (exif.Model) exifData.cameraModel = exif.Model;
    if (exif.LensModel) exifData.lensModel = exif.LensModel;

    if (exif.Artist) exifData.artist = exif.Artist;
    if (exif.Copyright) exifData.copyright = exif.Copyright;
    if (exif.Software) exifData.software = exif.Software;

    if (exif.ISO) exifData.iso = exif.ISO;

    // Convert exposure time to shutter speed format
    if (exif.ExposureTime) {
      if (exif.ExposureTime < 1) {
        exifData.shutterSpeed = `1/${Math.round(1 / exif.ExposureTime)}`;
      } else {
        exifData.shutterSpeed = `${exif.ExposureTime}s`;
      }
    }

    // Convert F-number to aperture format
    if (exif.FNumber) {
      exifData.aperture = `f/${exif.FNumber}`;
    }

    // Convert focal length to string format
    if (exif.FocalLength) {
      exifData.focalLength = `${exif.FocalLength}mm`;
    }

    // Convert DateTimeOriginal to ISO 8601
    if (exif.DateTimeOriginal) {
      exifData.dateTaken = new Date(exif.DateTimeOriginal).toISOString();
    }

    if (exif.Orientation) exifData.orientation = exif.Orientation;

    // GPS coordinates
    if (exif.GPSLatitude !== undefined) exifData.gpsLatitude = String(exif.GPSLatitude);
    if (exif.GPSLongitude !== undefined) exifData.gpsLongitude = String(exif.GPSLongitude);
    if (exif.GPSAltitude !== undefined) exifData.gpsAltitude = String(exif.GPSAltitude);

    // Additional metadata in extra field
    const extra: any = {};
    if (exif.WhiteBalance !== undefined) extra.whiteBalance = exif.WhiteBalance;
    if (exif.Flash !== undefined) extra.flash = exif.Flash;
    if (exif.ExposureMode !== undefined) extra.exposureMode = exif.ExposureMode;
    if (exif.MeteringMode !== undefined) extra.meteringMode = exif.MeteringMode;
    if (exif.ColorSpace !== undefined) extra.colorSpace = exif.ColorSpace;

    if (Object.keys(extra).length > 0) {
      exifData.extra = extra;
    }

    return Object.keys(exifData).length > 0 ? exifData : undefined;
  } catch (error) {
    console.warn(`Failed to extract EXIF data from ${file.name}:`, error);
    return undefined;
  }
};

/**
 * Get all images with optional EXIF data
 */
export const getImages = async (params?: GetImagesParams): Promise<Image[]> => {
  const response = await api.get<ApiListResponse<Image>>('/api/images', {
    params,
  })
  return response.data.data
}

/**
 * Get image statistics
 */
export const getImageStats = async (): Promise<ImageStats> => {
  const response = await api.get<ApiResponse<ImageStats>>('/api/images/stats')
  return response.data.data
}

/**
 * Get image by UUID
 */
export const getImageByUuid = async (uuid: string): Promise<Image> => {
  const response = await api.get<ApiResponse<Image>>(`/api/images/uuid/${uuid}`)
  return response.data.data
}

/**
 * Get multiple images by UUIDs
 */
export const getImagesByUuid = async (uuids: string[], withExif?: boolean): Promise<Image[]> => {
  const response = await api.post<GetImagesByUUIDResponse>('/api/images/batch/get/uuids', {
    uuids,
  }, {
    params: { withExif }
  })
  return response.data.data
}

/**
 * Update image EXIF data (single or batch)
 * Uses unified endpoint - array length determines if it's single or batch operation
 */
export const updateImageExif = async (
  updates: Array<{ uuid: string; exifData: Partial<ExifData> }>
): Promise<{ updated: Image[]; stats: { requested: number; successful: number; failed: number }; errors: Array<{ uuid: string; error: string }> }> => {
  const response = await api.patch<{
    success: boolean;
    message: string;
    data: {
      updated: Image[];
      stats: { requested: number; successful: number; failed: number };
      errors: Array<{ uuid: string; error: string }>;
    };
  }>('/api/images/update/exif', { updates })
  return response.data.data
}

/**
 * Delete images (single or batch)
 * Uses unified endpoint - array length determines if it's single or batch operation
 */
export const deleteImages = async (uuids: string[]): Promise<{ deleted: Image[]; stats: { requested: number; successful: number; failed: number } }> => {
  const response = await api.delete<{
    success: boolean;
    message: string;
    data: {
      deleted: Image[];
      stats: { requested: number; successful: number; failed: number };
    };
  }>('/api/images/delete', {
    data: { uuids }
  })
  return response.data.data
}

/**
 * Request presigned URLs for upload
 * Insert metadata into db with status:pending
 */
export const requestPresignedURLs = async (images: Omit<Image, "status" | "createdAt" | "updatedAt" | "deletedAt" | "id">[]): Promise<PreSignURLsResponse['data']> => {
  const response = await api.post<PreSignURLsResponse>('/api/images/presignUrls', { images })
  return response.data.data
}

/**
 * Upload to presigned MinIO PUT URL with mimetype
 */
export const uploadToPresignedURL = async (url: string, file: File | Blob, thumbnail?: boolean): Promise<boolean> => {
  try {
    // For presigned URLs, we send the file/blob directly as the body, not in FormData
    const contentType = thumbnail ? "image/jpeg" : file instanceof File ? file.type : 'image/jpeg';
    await api.put(url, file, {
      headers: {
        'Content-Type': contentType,
      },
    })
    return true
  } catch (error) {
    console.error('Error uploading to presigned URL:', error);
    return false
  }
}

/**
 * Replace images (single or batch) - Complete workflow with file uploads
 * Accepts files, calculates metadata, gets presigned URLs, and uploads
 * Uses unified endpoint - array length determines if it's single or batch operation
 */
export const replaceImages = async (
  replacements: Array<{
    uuid: string;
    file: File | Blob;
  }>
): Promise<{
  replaced: Image[];
  stats: { requested: number; successful: number; failed: number };
  errors: Array<{ uuid: string; error: string }>;
}> => {
  // Process all files to extract metadata
  const replacementRequests = await Promise.all(
    replacements.map(async ({ uuid, file }) => {
      const isFile = file instanceof File;
      const filename = isFile ? file.name : 'image.jpeg';
      const format = normalizeFormatFromFilename(filename);

      // Calculate dimensions
      let width = 0, height = 0;
      const imageUrl = URL.createObjectURL(file);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          width = img.naturalWidth;
          height = img.naturalHeight;
          URL.revokeObjectURL(imageUrl);
          resolve();
        };
        img.onerror = () => {
          URL.revokeObjectURL(imageUrl);
          reject(new Error('Failed to load image'));
        };
        img.src = imageUrl;
      });

      // Calculate file hash using Web Crypto API
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Extract EXIF data (only for File objects)
      const exifData = isFile ? await extractExifData(file as File) : undefined;

      return {
        uuid,
        filename,
        format,
        mimeType: file.type || 'image/jpeg',
        width,
        height,
        fileSize: file.size,
        hash,
        exifData,
      };
    })
  );

  // Request presigned URLs from the server
  const response = await api.patch<{
    success: boolean;
    message: string;
    data: {
      replaced: Array<{
        image: Image;
        uploadUrls: {
          imageUrl: string;
          thumbnailUrl: string;
          expiresIn: number;
        };
      }>;
      stats: { requested: number; successful: number; failed: number };
      errors: Array<{ uuid: string; error: string }>;
    };
  }>('/api/images/replace', { replacements: replacementRequests });

  const result = response.data.data;

  // Upload files to presigned URLs
  const { generateThumbnailBlob } = await import('@/utils/thumbnailGenerator');
  const uploadedImages: Image[] = [];
  const uploadErrors: Array<{ uuid: string; error: string }> = [...result.errors];

  for (let i = 0; i < result.replaced.length; i++) {
    const replacement = result.replaced[i];
    const originalFile = replacements[i].file;

    try {
      // Generate and upload thumbnail first
      const thumbnailBlob = await generateThumbnailBlob(originalFile, 300);
      const thumbnailSuccess = await uploadToPresignedURL(
        replacement.uploadUrls.thumbnailUrl,
        thumbnailBlob,
        true
      );

      if (!thumbnailSuccess) {
        throw new Error('Failed to upload thumbnail');
      }

      // Upload the image
      const imageSuccess = await uploadToPresignedURL(
        replacement.uploadUrls.imageUrl,
        originalFile,
        false
      );

      if (!imageSuccess) {
        throw new Error('Failed to upload image');
      }

      uploadedImages.push(replacement.image);
    } catch (error) {
      uploadErrors.push({
        uuid: replacement.image.uuid,
        error: error instanceof Error ? error.message : 'Upload failed',
      });
    }
  }

  return {
    replaced: uploadedImages,
    stats: {
      requested: replacements.length,
      successful: uploadedImages.length,
      failed: uploadErrors.length,
    },
    errors: uploadErrors,
  };
}


/**
 * Request download URLs with metadata and EXIF data
 */
export const requestDownloadUrls = async (
  uuids: string[],
  expiry?: number
): Promise<Array<{
  uuid: string;
  filename: string;
  downloadUrl: string;
  expiresIn: number;
  metadata: any;
  exifData: ExifData | null;
}>> => {
  const response = await api.post<{
    success: boolean;
    count: number;
    data: {
      downloads: Array<{
        uuid: string;
        filename: string;
        downloadUrl: string;
        expiresIn: number;
        metadata: any;
        exifData: ExifData | null;
      }>;
      stats: { requested: number; successful: number; failed: number };
      errors: Array<{ uuid: string; error: string }>;
    };
  }>('/api/images/requestDownloadUrls', { uuids }, {
    params: { expiry }
  })
  return response.data.data.downloads
}

/**
 * Get minimal metadata for all images (for efficient sync state comparison)
 */
export const getImagesMetadata = async (
  since?: number
): Promise<{
  data: Array<{
    uuid: string;
    hash: string;
    updatedAt: string;
    fileSize: number;
  }>;
  currentSequence: number;
  count: number;
}> => {
  const response = await api.get<{
    success: boolean;
    count: number;
    currentSequence: number;
    data: Array<{
      uuid: string;
      hash: string;
      updatedAt: string;
      fileSize: number;
    }>;
  }>('/api/images/metadata', {
    params: { since }
  })
  return {
    data: response.data.data,
    currentSequence: response.data.currentSequence,
    count: response.data.count,
  }
}

