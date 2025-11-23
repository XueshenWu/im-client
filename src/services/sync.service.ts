import api from './api'
import {
  SyncOperationsResponse,
  SyncStatusResponse,
  SyncCurrentResponse,
  MyOperationsResponse,
} from '@/types/api'

/**
 * Get current sync sequence number
 */
export const getCurrentSequence = async (): Promise<number> => {
  const response = await api.get<SyncCurrentResponse>('/api/sync/current')
  return response.data.data.currentSequence
}

/**
 * Get sync operations since a specific sequence number
 * @param since - Sequence number to get operations after
 * @param limit - Maximum number of operations to return (default: 100)
 */
export const getSyncOperations = async (
  since: number,
  limit: number = 100
): Promise<SyncOperationsResponse> => {
  const response = await api.get<SyncOperationsResponse>('/api/sync/operations', {
    params: { since, limit },
  })
  return response.data
}

/**
 * Get sync status - check if client is in sync with server
 */
export const getSyncStatus = async (): Promise<SyncStatusResponse['data']> => {
  const response = await api.get<SyncStatusResponse>('/api/sync/status')
  return response.data.data
}

/**
 * Get operations performed by the current client
 * @param limit - Maximum number of operations to return
 */
export const getMyOperations = async (limit?: number): Promise<MyOperationsResponse> => {
  const response = await api.get<MyOperationsResponse>('/api/sync/my-operations', {
    params: { limit },
  })
  return response.data
}
