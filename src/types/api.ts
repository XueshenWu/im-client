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
  previewUrl?: string
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

// Chunked Upload Types
export interface InitChunkedUploadRequest {
  filename: string
  totalSize: number
  chunkSize: number
  totalChunks: number
  mimeType?: string
}

export interface InitChunkedUploadResponse {
  success: boolean
  data: {
    sessionId: string
    filename: string
    totalChunks: number
    chunkSize: number
    expiresAt: string
  }
}

export interface UploadChunkRequest {
  chunk: Blob
  chunkNumber: number
}

export interface UploadChunkResponse {
  success: boolean
  message: string
  data: {
    sessionId: string
    chunkNumber: number
    uploadedChunks: number
    totalChunks: number
    isComplete: boolean
  }
}

export interface CompleteChunkedUploadResponse {
  success: boolean
  message: string
  data: Image
}

export interface ChunkedUploadStatus {
  success: boolean
  data: {
    sessionId: string
    filename: string
    originalName: string
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'expired'
    uploadedChunks: number
    totalChunks: number
    uploadedChunksList: number[]
    progress: string
    expiresAt: string
    createdAt: string
  }
}

export interface CancelChunkedUploadResponse {
  success: boolean
  message: string
}

export interface UploadImagesResponse {
  success: boolean
  message: string
  data?: Image[]
}

// Pagination Types
export interface PaginationMeta {
  nextCursor: string | null
  hasMore: boolean
  limit: number
}

export interface PagePaginationMeta {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface PaginatedImagesResponse {
  success: boolean
  count: number
  data: Image[]
  pagination: PaginationMeta
}

export interface GetPaginatedImagesParams {
  limit?: number
  cursor?: string
  collectionId?: number
  withExif?: boolean
}


export interface GetPagePaginatedImagesResponse {
  success: boolean
  count: number
  data: Image[]
  pagination: PagePaginationMeta
}



export interface GetPagePaginatedImagesParams {
  page: number
  pageSize: number
  collectionId?: number
  withExif?: boolean
  sortBy?: 'name' | 'size' | 'type' | 'updatedAt' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}

// Collection Types
export interface Collection {
  id: number
  uuid: string
  name: string
  description?: string
  coverImageId?: number
  imageCount: number
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

export interface CollectionsResponse {
  success: boolean
  count: number
  data: Collection[]
}

export interface CreateCollectionRequest {
  name: string
  description?: string
  coverImageId?: number
}

export interface UpdateCollectionRequest {
  name?: string
  description?: string
  coverImageId?: number
}
