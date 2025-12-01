import api from './api'
import {
  SyncOperationsResponse,
  SyncStatusResponse,
  SyncCurrentResponse,
  MyOperationsResponse,
} from '@/types/api'


// Get current sync sequence number
export const getCurrentSequence = async (): Promise<number> => {
  const response = await api.get<SyncCurrentResponse>('/api/sync/current')
  return response.data.data.currentSequence
}


// Get sync operations since a specific sequence number
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
 * Also extracts syncUUID from response headers for local mode
 */
export const getSyncStatus = async (): Promise<SyncStatusResponse['data'] & { syncUUID?: string }> => {
  const response = await api.get<SyncStatusResponse>('/api/sync/status')

  const syncUUID = response.headers?.['x-current-sync-uuid'];

  return {
    ...response.data.data,
    ...(syncUUID && { syncUUID }),
  };
}


// Get operations performed by the current client
export const getMyOperations = async (limit?: number): Promise<MyOperationsResponse> => {
  const response = await api.get<MyOperationsResponse>('/api/sync/my-operations', {
    params: { limit },
  })
  return response.data
}


export const acquireLwwLock = async (): Promise<string> => {
  const response = await api.post<{
    success: boolean
    lockUuid: string
    message: string
  }>('/api/sync/lock/acquire')
  return response.data.lockUuid
}


export const releaseLwwLock = async (lockUuid: string): Promise<{
  syncSequence: number;
  syncUUID: string;
}> => {
  const response = await api.post<{
    success: boolean;
    message: string;
    syncSequence: number;
    syncUUID: string;
  }>('/api/sync/lock/release', { lockUuid });

  return {
    syncSequence: response.data.syncSequence,
    syncUUID: response.data.syncUUID,
  };
}


export const syncService = {
  getCurrentSequence,
  getSyncOperations,
  getSyncStatus,
  getMyOperations,
  acquireLwwLock,
  releaseLwwLock,
}
