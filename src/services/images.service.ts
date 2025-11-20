import api from './api'
import {
  ApiResponse,
  ApiListResponse,
  Image,
  ImageStats,
  GetImagesParams,
  UpdateImageRequest,
  DeleteImageResponse,
  InitChunkedUploadRequest,
  InitChunkedUploadResponse,
  UploadChunkResponse,
  CompleteChunkedUploadResponse,
  ChunkedUploadStatus,
  CancelChunkedUploadResponse,
  UploadImagesResponse,
} from '@/types/api'

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
 * Get image by ID
 */
export const getImageById = async (id: number): Promise<Image> => {
  const response = await api.get<ApiResponse<Image>>(`/api/images/${id}`)
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
 * Update image metadata
 */
export const updateImage = async (
  id: number,
  data: UpdateImageRequest
): Promise<Image> => {
  const response = await api.put<ApiResponse<Image>>(`/api/images/${id}`, data)
  return response.data.data
}

/**
 * Delete image (soft delete)
 */
export const deleteImage = async (id: number): Promise<DeleteImageResponse> => {
  const response = await api.delete<DeleteImageResponse>(`/api/images/${id}`)
  return response.data
}

/**
 * Upload images (multipart form-data)
 */
export const uploadImages = async (files: File[]): Promise<UploadImagesResponse> => {
  const formData = new FormData()

  // Debug: Log what we're uploading
  console.log('Uploading files:', files.length, 'files')

  files.forEach((file, index) => {
    console.log(`File ${index}:`, file.name, file.type, file.size)
    formData.append('images', file)
  })

  // Debug: Log FormData contents
  console.log('FormData entries:')
  for (const pair of formData.entries()) {
    console.log(pair[0], ':', pair[1])
  }

  const response = await api.post<UploadImagesResponse>('/api/images/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  return response.data
}

/**
 * Batch upload from folder config
 */
export const batchUpload = async (config: Record<string, any>): Promise<any> => {
  const response = await api.post('/api/images/batch', config)
  return response.data
}

// ===== Chunked Upload APIs =====

/**
 * Initialize a chunked upload session
 * @param request Upload session initialization parameters
 * @returns Upload session details including sessionId
 */
export const initChunkedUpload = async (
  request: InitChunkedUploadRequest
): Promise<InitChunkedUploadResponse['data']> => {
  const response = await api.post<InitChunkedUploadResponse>(
    '/api/images/chunked/init',
    request
  )
  return response.data.data
}

/**
 * Upload a single chunk to an existing session
 * @param sessionId Upload session ID
 * @param chunk File chunk as Blob
 * @param chunkNumber Zero-based chunk index
 * @returns Upload progress information
 */
export const uploadChunk = async (
  sessionId: string,
  chunk: Blob,
  chunkNumber: number
): Promise<UploadChunkResponse['data']> => {
  const formData = new FormData()
  formData.append('chunk', chunk)
  formData.append('chunkNumber', chunkNumber.toString())

  const response = await api.post<UploadChunkResponse>(
    `/api/images/chunked/upload/${sessionId}`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  )
  return response.data.data
}

/**
 * Complete chunked upload and assemble the file
 * @param sessionId Upload session ID
 * @returns The created Image object
 */
export const completeChunkedUpload = async (
  sessionId: string
): Promise<Image> => {
  const response = await api.post<CompleteChunkedUploadResponse>(
    `/api/images/chunked/complete/${sessionId}`
  )
  return response.data.data
}

/**
 * Get the status of an upload session
 * @param sessionId Upload session ID
 * @returns Current upload session status
 */
export const getChunkedUploadStatus = async (
  sessionId: string
): Promise<ChunkedUploadStatus['data']> => {
  const response = await api.get<ChunkedUploadStatus>(
    `/api/images/chunked/status/${sessionId}`
  )
  return response.data.data
}

/**
 * Cancel and cleanup an upload session
 * @param sessionId Upload session ID
 * @returns Cancellation confirmation
 */
export const cancelChunkedUpload = async (
  sessionId: string
): Promise<CancelChunkedUploadResponse> => {
  const response = await api.delete<CancelChunkedUploadResponse>(
    `/api/images/chunked/${sessionId}`
  )
  return response.data
}
