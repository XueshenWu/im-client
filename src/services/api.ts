import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios'
import { ApiError } from '@/types/api'
import { syncClient } from './syncClient'

// Get API URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// Create axios instance with default configuration
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
api.interceptors.request.use(
  async (config) => {
    // Add sync headers for write operations
    if (config.method && ['get', 'post', 'put', 'delete', 'patch'].includes(config.method.toLowerCase())) {
      // Import syncClient lazily to avoid circular dependencies
      try {
        // We'll add sync headers dynamically
        const clientId = await syncClient.waitForClientId()
        const lastSyncSequence = syncClient.getLastSyncSequence()

        if (clientId) {
          config.headers['X-Client-ID'] = clientId
          config.headers['X-Last-Sync-Sequence'] = lastSyncSequence.toString()
          console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url} - Sending seq: ${lastSyncSequence}`)
        }
      } catch (error) {
        console.warn('[API] Failed to add sync headers:', error)
      }
    }

    // You can add authentication headers here if needed
    // const token = localStorage.getItem('token')
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`
    // }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
api.interceptors.response.use(
  (response: AxiosResponse) => {



    // Update sync sequence from response headers
    const currentSequence = response.headers['x-current-sequence']
    if (currentSequence) {
      const sequence = parseInt(currentSequence, 10)
      if (!isNaN(sequence)) {
        const oldSeq = syncClient.getLastSyncSequence()
        console.log(`[API Response] ${response.config.method?.toUpperCase()} ${response.config.url} - Server seq: ${sequence}, Old client seq: ${oldSeq}`)
        syncClient.updateLastSyncSequence(sequence)
        console.log(`[API Response] Updated client seq to: ${syncClient.getLastSyncSequence()}`)
      }
    }
    return response
  },
  async (error: AxiosError<ApiError>) => {
    // Handle 409 Conflict - Sync conflict detected
    if (error.response?.status === 409) {
      console.warn('[API] Sync conflict detected (409). Client needs to sync.')

      // Get operations behind from header
      const operationsBehind = error.response.headers['x-operations-behind']
      const parsedBehind = operationsBehind ? parseInt(operationsBehind, 10) : undefined

      // Store conflict info for the application to handle
      const conflictError: ApiError = {
        error: 'Sync Conflict',
        message: error.response.data?.message || 'Your client is out of sync. Please sync and retry.',
        statusCode: 409,
      }

      // Attach extra info
      ;(conflictError as any).operationsBehind = parsedBehind
      ;(conflictError as any).requiresSync = true

      return Promise.reject(conflictError)
    }

    // Handle different error scenarios
    if (error.response) {
      // Server responded with error status
      const apiError: ApiError = {
        error: error.response.data?.error || 'Server Error',
        message: error.response.data?.message || error.message,
        statusCode: error.response.status,
      }
      console.error('API Error:', apiError)
      return Promise.reject(apiError)
    } else if (error.request) {
      // Request made but no response received
      const networkError: ApiError = {
        error: 'Network Error',
        message: 'No response from server. Please check your connection.',
        statusCode: 0,
      }
      console.error('Network Error:', networkError)
      return Promise.reject(networkError)
    } else {
      // Error setting up the request
      const requestError: ApiError = {
        error: 'Request Error',
        message: error.message,
        statusCode: 0,
      }
      console.error('Request Error:', requestError)
      return Promise.reject(requestError)
    }
  }
)

// API Service Functions
export const imageService = {
  /**
   * Fetch cursor paginated images from the cloud server
   */
  async getPaginatedImages(params?: import('@/types/api').GetPaginatedImagesParams): Promise<import('@/types/api').PaginatedImagesResponse> {
    const response = await api.get<import('@/types/api').PaginatedImagesResponse>('/api/images/paginated', {
      params,
    })
    return response.data
  },

  /**
   * Fetch page paginated images from the cloud server
   */
  async getPagePaginatedImages(params?:import('@/types/api').GetPagePaginatedImagesParams): Promise<import('@/types/api').GetPagePaginatedImagesResponse> {
    const response = await api.get<import('@/types/api').GetPagePaginatedImagesResponse>('/api/images/page', {
      params,
    })
    return response.data
  },




  /**
   * Get thumbnail URL for cloud images
   * Thumbnails are publicly accessible from MinIO storage
   */
  getThumbnailUrl(uuid: string, format: string): string {
    return `${API_BASE_URL}/storage/thumbnails/${uuid}.${format}`
  },

  /**
   * Get presigned URL endpoint for cloud images
   * Full images require a presigned URL from the server
   */
  getImageFileUrl(uuid: string): string {
    return `${API_BASE_URL}/api/images/file/uuid/${uuid}`
  },

  /**
   * Fetch all collections
   */
  async getCollections(): Promise<import('@/types/api').CollectionsResponse> {
    const response = await api.get<import('@/types/api').CollectionsResponse>('/api/collections')
    return response.data
  },
}

export default api
