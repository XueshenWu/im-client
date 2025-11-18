import api from './api'
import {
  ApiResponse,
  ApiListResponse,
  Image,
  ImageStats,
  GetImagesParams,
  UpdateImageRequest,
  DeleteImageResponse,
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
export const uploadImages = async (files: File[]): Promise<any> => {
  const formData = new FormData()

  files.forEach((file) => {
    formData.append('images', file)
  })

  const response = await api.post('/api/images/upload', formData, {
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
