import { SyncOperation } from '@/types/api'
import {
  getCurrentSequence,
  getSyncOperations,
  getSyncStatus,
} from './sync.service'

/**
 * Simple UUID v4 generator (without external dependencies)
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

const STORAGE_KEY_SEQUENCE = 'lastSyncSequence'
const STORAGE_KEY_CLIENT_ID = 'clientId'

export type SyncEventType = 'sync_started' | 'sync_completed' | 'sync_error' | 'operation_applied' | 'conflict_detected'| 'client_id_ready'

export interface SyncEvent {
  type: SyncEventType
  data?: any
}

export type SyncEventListener = (event: SyncEvent) => void

/**
 * ImageSyncClient - Handles synchronization with the server using Git-like sequence tracking
 *
 * This client:
 * - Tracks the last known sync sequence
 * - Sends sync headers with every request
 * - Handles 409 conflicts automatically
 * - Provides periodic background sync
 * - Applies server operations to local state
 */
export class ImageSyncClient {
  private lastSyncSequence: number
  private clientId: string | null = null
  private autoSyncInterval: NodeJS.Timeout | null = null
  private eventListeners: SyncEventListener[] = []
  private isSyncing: boolean = false

  private initPromise: Promise<void>;

  constructor() {
    // Load or generate client ID
    // const storedClientId = localStorage.getItem(STORAGE_KEY_CLIENT_ID)
    // if (storedClientId) {
    //   this.clientId = storedClientId
    // } else {
    //   this.clientId = this.generateClientId()
    //   localStorage.setItem(STORAGE_KEY_CLIENT_ID, this.clientId)
    // }

    // Load last sync sequence
    const storedSequence = localStorage.getItem(STORAGE_KEY_SEQUENCE)
    this.lastSyncSequence = storedSequence ? parseInt(storedSequence, 10) : 0
    this.initPromise = this.internalInit()
    console.log(`[SyncClient] Initialized with lastSequence: ${this.lastSyncSequence} and promised clientId`)
  }

  private async internalInit(): Promise<void> {
    const storedClientId = localStorage.getItem(STORAGE_KEY_CLIENT_ID)

    if (storedClientId) {
      // 1. Fast path: We have it in storage
      this.clientId = storedClientId
    } else {
      // 2. Slow path: Generate via Electron/Hardware
      this.clientId = await this.aGenerateClientId()
      localStorage.setItem(STORAGE_KEY_CLIENT_ID, this.clientId)
    }

    console.log(`[SyncClient] Ready. ClientId: ${this.clientId}`)
    this.emitEvent({ type: 'client_id_ready', data: { clientId: this.clientId } })
  }

  private updateSequence(seq: number){
    this.lastSyncSequence = seq
    localStorage.setItem(STORAGE_KEY_SEQUENCE, seq.toString())
    console.log(`[SyncClient] Updated lastSyncSequence to ${seq}`)
  }

  async waitForClientId(): Promise<string> {
    if (this.clientId) return this.clientId
    await this.initPromise
    return this.clientId!
  }

  /**
   * Generate a unique client ID
   */
  private generateClientId(): string {
    const platform = typeof window !== 'undefined' ? 'web' : 'desktop'
    const uuid = generateUUID()
    return `${platform}-app-v1.0-${uuid}`
  }

  private async aGenerateClientId(): Promise<string> {
    const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined
    const platform = isElectron ? 'desktop' : 'web'
    console.log('platform: ', platform)
    let uniqueId: string

    if (isElectron) {
      try {
        // Await the hardware ID from the main process
        uniqueId = await window.electronAPI!.getDeviceId()
      } catch (e) {
        console.warn('Failed to get hardware ID, falling back to random')
        uniqueId = generateUUID()
      }
    } else {
      uniqueId = generateUUID()
    }

    return `${platform}-app-v1.0-${uniqueId}`
  }

  /**
   * Get the current client ID
   */
  getClientId(): string {
    // FIXME: Need to asynchify this
    return this.clientId || ""
  }

  /**
   * Get the last sync sequence
   */
  getLastSyncSequence(): number {
    return this.lastSyncSequence
  }

  /**
   * Update the last sync sequence
   */
  updateLastSyncSequence(sequence: number): void {
    const oldSeq = this.lastSyncSequence
    this.lastSyncSequence = sequence
    localStorage.setItem(STORAGE_KEY_SEQUENCE, sequence.toString())
    if (oldSeq !== sequence) {
      console.log(`[SyncClient] ✅ Updated lastSyncSequence: ${oldSeq} → ${sequence}`)
    } else {
      console.log(`[SyncClient] ℹ️  Sequence unchanged: ${sequence}`)
    }
  }

  /**
   * Get sync headers to include in requests
   */
 // FIXME: Need to asynchify this
  getSyncHeaders(): Record<string, string> {
    return {
      'X-Client-ID': this.clientId || "",
      'X-Last-Sync-Sequence': this.lastSyncSequence.toString(),
    }
  }

  /**
   * Add an event listener
   */
  addEventListener(listener: SyncEventListener): void {
    this.eventListeners.push(listener)
  }

  /**
   * Remove an event listener
   */
  removeEventListener(listener: SyncEventListener): void {
    this.eventListeners = this.eventListeners.filter(l => l !== listener)
  }

  /**
   * Emit an event to all listeners
   */
  private emitEvent(event: SyncEvent): void {
    this.eventListeners.forEach(listener => listener(event))
  }

  /**
   * Perform a sync operation - fetch and apply all operations since last sync
   */
  async sync(): Promise<void> {
    if (this.isSyncing) {
      console.log('[SyncClient] Sync already in progress, skipping')
      return
    }

    this.isSyncing = true
    this.emitEvent({ type: 'sync_started' })

    try {
      let hasMore = true
      let currentSince = this.lastSyncSequence
      let totalApplied = 0

      while (hasMore) {
        const response = await getSyncOperations(currentSince, 100)

        // Apply each operation
        for (const operation of response.data) {
          await this.applyOperation(operation)
          totalApplied++
        }

        // Update sequence
        this.updateLastSyncSequence(response.sync.currentSequence)

        // Check if there are more operations to fetch
        hasMore = response.sync.hasMore
        if (hasMore) {
          currentSince = response.sync.currentSequence
        }
      }

      console.log(`[SyncClient] Sync completed. Applied ${totalApplied} operations. Now at sequence ${this.lastSyncSequence}`)
      this.emitEvent({
        type: 'sync_completed',
        data: { operationsApplied: totalApplied, currentSequence: this.lastSyncSequence }
      })
    } catch (error) {
      console.error('[SyncClient] Sync failed:', error)
      this.emitEvent({ type: 'sync_error', data: error })
      throw error
    } finally {
      this.isSyncing = false
    }
  }

  /**
   * Apply a single sync operation to local state
   * Override this method to customize how operations are applied
   */
  protected async applyOperation(operation: SyncOperation): Promise<void> {
    console.log(`[SyncClient] Applying operation:`, operation)

    this.emitEvent({ type: 'operation_applied', data: operation })

    // Emit custom events for specific operation types
    // This allows components to react to specific operations
    switch (operation.operation) {
      case 'upload':
        window.dispatchEvent(new CustomEvent('sync:image-uploaded', { detail: operation }))
        break
      case 'delete':
        window.dispatchEvent(new CustomEvent('sync:image-deleted', { detail: operation }))
        break
      case 'update':
        window.dispatchEvent(new CustomEvent('sync:image-updated', { detail: operation }))
        break
      case 'replace':
        window.dispatchEvent(new CustomEvent('sync:image-replaced', { detail: operation }))
        break
      case 'batch_upload':
      case 'batch_delete':
        window.dispatchEvent(new CustomEvent('sync:batch-operation', { detail: operation }))
        break
    }
  }

  /**
   * Check sync status
   */
  async checkSyncStatus(): Promise<{
    isInSync: boolean
    operationsBehind: number
    currentSequence: number
  }> {
    const status = await getSyncStatus()
    return {
      isInSync: status.isInSync,
      operationsBehind: status.operationsBehind,
      currentSequence: status.currentSequence,
    }
  }

  /**
   * Start automatic background sync
   * @param intervalMs - Sync interval in milliseconds (default: 30 seconds)
   */
  startAutoSync(intervalMs: number = 30000): void {
    if (this.autoSyncInterval) {
      console.log('[SyncClient] Auto-sync already running')
      return
    }

    console.log(`[SyncClient] Starting auto-sync every ${intervalMs}ms`)
    this.autoSyncInterval = setInterval(() => {
      this.sync().catch(err => {
        console.error('[SyncClient] Auto-sync failed:', err)
      })
    }, intervalMs)
  }

  /**
   * Stop automatic background sync
   */
  stopAutoSync(): void {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval)
      this.autoSyncInterval = null
      console.log('[SyncClient] Auto-sync stopped')
    }
  }

  /**
   * Handle 409 conflict response
   * This should be called when you receive a 409 response from the server
   */
  async handleConflict(operationsBehind?: number): Promise<void> {
    console.log(`[SyncClient] Conflict detected. Behind by ${operationsBehind || 'unknown'} operations`)
    this.emitEvent({ type: 'conflict_detected', data: { operationsBehind } })
    await this.sync()
  }

  /**
   * Reset sync state (useful for testing or when switching servers)
   */
  reset(): void {
    this.stopAutoSync()
    this.lastSyncSequence = 0
    localStorage.setItem(STORAGE_KEY_SEQUENCE, '0')
    console.log('[SyncClient] Sync state reset')
  }

  /**
   * Perform initial sync on app startup
   */
  async initialize(): Promise<void> {
    console.log('[SyncClient] Initializing...')
    try {
      await this.sync()
      console.log('[SyncClient] Initialization complete')
    } catch (error) {
      console.error('[SyncClient] Initialization failed:', error)
      throw error
    }
  }
}

// Create and export a singleton instance
export const syncClient = new ImageSyncClient()
