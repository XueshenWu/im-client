import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios'
import { ApiError } from '@/types/api'

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
  (config) => {
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
    return response
  },
  (error: AxiosError<ApiError>) => {
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

export default api
