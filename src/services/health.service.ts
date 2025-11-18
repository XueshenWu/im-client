import api from './api'
import { HealthCheck } from '@/types/api'

/**
 * Health check endpoint
 * @returns Health status with database connection info
 */
export const checkHealth = async (): Promise<HealthCheck> => {
  const response = await api.get<HealthCheck>('/api/health')
  return response.data
}
