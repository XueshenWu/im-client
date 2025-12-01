import api from './api'
import { HealthCheck } from '@/types/api'

export const checkHealth = async (): Promise<HealthCheck> => {
  const response = await api.get<HealthCheck>('/api/health')
  return response.data
}
