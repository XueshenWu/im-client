// API Response Types based on openapi.json

export interface ApiResponse<T> {
  success: boolean
  data: T
}

export interface ApiListResponse<T> {
  success: boolean
  count: number
  data: T[]
}

export interface ApiError {
  error: string
  message: string
  statusCode: number
}

// Image Types
export interface Image {
  id: number
  uuid: string
  filename: string
  originalName: string
  filePath: string
  thumbnailPath: string
  fileSize: number
  format: 'jpg' | 'jpeg' | 'png' | 'tif' | 'tiff'
  width: number
  height: number
  hash: string
  mimeType: string
  isCorrupted: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  exifData?: ExifData
}

export interface ExifData {
  id: number
  imageId: number
  cameraMake?: string
  cameraModel?: string
  lensModel?: string
  iso?: number
  shutterSpeed?: string
  aperture?: string
  focalLength?: string
  dateTaken?: string
  gpsLatitude?: number
  gpsLongitude?: number
  gpsAltitude?: number
  orientation?: number
  metadata?: Record<string, any>
}

export interface ImageStats {
  totalCount: number
  totalSize: number
  corruptedCount: number
  jpgCount: number
  pngCount: number
  tifCount: number
}

export interface HealthCheck {
  status: string
  timestamp: string
  database: string
}

// Request Types
export interface GetImagesParams {
  withExif?: boolean
}

export interface UpdateImageRequest {
  filename?: string
  originalName?: string
}

export interface UploadImagesRequest {
  images: File[]
}

export interface DeleteImageResponse {
  success: boolean
  message: string
}
