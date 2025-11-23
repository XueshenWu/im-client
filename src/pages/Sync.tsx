import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { syncClient, SyncEvent } from '@/services/syncClient'
import { getSyncStatus, getMyOperations, getCurrentSequence } from '@/services/sync.service'
import { SyncOperation } from '@/types/api'

export default function Sync() {
  const [isLoading, setIsLoading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<{
    currentSequence: number
    clientLastSequence: number
    isInSync: boolean
    operationsBehind: number
  } | null>(null)
  const [myOperations, setMyOperations] = useState<SyncOperation[]>([])
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [syncEvents, setSyncEvents] = useState<string[]>([])

  // Load sync status on mount
  useEffect(() => {
    loadSyncStatus()
    loadMyOperations()

    // Subscribe to sync events
    const eventListener = (event: SyncEvent) => {
      const timestamp = new Date().toLocaleTimeString()
      const eventMsg = `[${timestamp}] ${event.type}: ${JSON.stringify(event.data || {})}`
      setSyncEvents(prev => [eventMsg, ...prev].slice(0, 20)) // Keep last 20 events

      if (event.type === 'sync_started') {
        setIsSyncing(true)
      } else if (event.type === 'sync_completed') {
        setIsSyncing(false)
        setLastSyncTime(new Date())
        loadSyncStatus() // Refresh status after sync
      } else if (event.type === 'sync_error') {
        setIsSyncing(false)
      }
    }

    syncClient.addEventListener(eventListener)

    return () => {
      syncClient.removeEventListener(eventListener)
    }
  }, [])

  const loadSyncStatus = async () => {
    try {
      const status = await getSyncStatus()
      setSyncStatus(status)
    } catch (error) {
      console.error('Failed to load sync status:', error)
    }
  }

  const loadMyOperations = async () => {
    try {
      const response = await getMyOperations(10)
      setMyOperations(response.data)
    } catch (error) {
      console.error('Failed to load my operations:', error)
    }
  }

  const handleManualSync = async () => {
    setIsSyncing(true)
    try {
      await syncClient.sync()
      await loadSyncStatus()
      await loadMyOperations()
    } catch (error) {
      console.error('Sync failed:', error)
      alert('Sync failed. Check console for details.')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleToggleAutoSync = () => {
    if (autoSyncEnabled) {
      syncClient.stopAutoSync()
      setAutoSyncEnabled(false)
    } else {
      syncClient.startAutoSync(30000) // 30 seconds
      setAutoSyncEnabled(true)
    }
  }

  const handleResetSync = () => {
    if (confirm('Are you sure you want to reset sync state? This will set your sequence to 0.')) {
      syncClient.reset()
      loadSyncStatus()
      setSyncEvents([])
      setLastSyncTime(null)
    }
  }

  const handleInitialize = async () => {
    setIsLoading(true)
    try {
      await syncClient.initialize()
      await loadSyncStatus()
      await loadMyOperations()
      alert('Sync initialized successfully!')
    } catch (error) {
      console.error('Initialization failed:', error)
      alert('Initialization failed. Check console for details.')
    } finally {
      setIsLoading(false)
    }
  }

  const getOperationIcon = (operation: string) => {
    switch (operation) {
      case 'upload':
        return '⬆️'
      case 'delete':
        return '🗑️'
      case 'update':
        return '✏️'
      case 'replace':
        return '🔄'
      case 'batch_upload':
        return '⬆️📦'
      case 'batch_delete':
        return '🗑️📦'
      default:
        return '❓'
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Sync Management</h1>
        <p className="text-gray-600">
          Manage synchronization between your client and the server using Git-like sequence tracking
        </p>
      </div>

      {/* Sync Status Card */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Sync Status</h2>
          <Button onClick={loadSyncStatus} variant="outline" size="sm">
            Refresh
          </Button>
        </div>

        {syncStatus ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Client ID</div>
              <div className="font-mono text-sm truncate" title={syncClient.getClientId()}>
                {syncClient.getClientId().substring(0, 20)}...
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Server Sequence</div>
              <div className="text-2xl font-bold">{syncStatus.currentSequence}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Client Sequence</div>
              <div className="text-2xl font-bold">{syncClient.getLastSyncSequence()}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Status</div>
              <div className="flex items-center gap-2">
                {syncStatus.isInSync ? (
                  <span className="text-green-600 font-semibold">✓ In Sync</span>
                ) : (
                  <span className="text-orange-600 font-semibold">
                    ⚠ Behind by {syncStatus.operationsBehind}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-gray-500">Loading status...</div>
        )}

        {lastSyncTime && (
          <div className="mt-4 text-sm text-gray-600">
            Last sync: {lastSyncTime.toLocaleString()}
          </div>
        )}
      </div>

      {/* Sync Controls */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Controls</h2>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSyncing ? '🔄 Syncing...' : '🔄 Manual Sync'}
          </Button>
          <Button
            onClick={handleToggleAutoSync}
            variant={autoSyncEnabled ? 'destructive' : 'default'}
          >
            {autoSyncEnabled ? '⏸ Stop Auto-Sync' : '▶️ Start Auto-Sync (30s)'}
          </Button>
          <Button onClick={handleInitialize} disabled={isLoading} variant="outline">
            {isLoading ? 'Initializing...' : '🚀 Initialize'}
          </Button>
          <Button onClick={handleResetSync} variant="outline">
            🔄 Reset Sync State
          </Button>
        </div>
      </div>

      {/* Recent Sync Events */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Recent Sync Events</h2>
        {syncEvents.length > 0 ? (
          <div className="bg-gray-900 text-green-400 font-mono text-xs p-4 rounded-lg max-h-64 overflow-y-auto">
            {syncEvents.map((event, index) => (
              <div key={index} className="mb-1">
                {event}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-500">No events yet. Perform a sync to see events.</div>
        )}
      </div>

      {/* My Operations */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">My Recent Operations</h2>
          <Button onClick={loadMyOperations} variant="outline" size="sm">
            Refresh
          </Button>
        </div>

        {myOperations.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 text-sm font-semibold">Seq</th>
                  <th className="text-left py-2 px-3 text-sm font-semibold">Operation</th>
                  <th className="text-left py-2 px-3 text-sm font-semibold">Image UUID</th>
                  <th className="text-left py-2 px-3 text-sm font-semibold">Time</th>
                  <th className="text-left py-2 px-3 text-sm font-semibold">Metadata</th>
                </tr>
              </thead>
              <tbody>
                {myOperations.map((op) => (
                  <tr key={op.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-3 font-mono text-sm">{op.sequenceNumber}</td>
                    <td className="py-2 px-3">
                      <span className="text-lg mr-2">{getOperationIcon(op.operation)}</span>
                      <span className="text-sm">{op.operation}</span>
                    </td>
                    <td className="py-2 px-3 font-mono text-xs">
                      {op.imageUuid ? op.imageUuid.substring(0, 8) : '-'}
                    </td>
                    <td className="py-2 px-3 text-sm">
                      {new Date(op.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-xs text-gray-600">
                      {Object.keys(op.metadata || {}).length > 0
                        ? JSON.stringify(op.metadata).substring(0, 50) + '...'
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-gray-500">No operations found for your client.</div>
        )}
      </div>

      {/* Documentation */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold mb-2">ℹ️ How Sync Works</h3>
        <div className="text-sm text-gray-700 space-y-2">
          <p>
            <strong>Git-like Sequence Tracking:</strong> Every operation (upload, delete, update)
            gets a unique sequence number, like Git commits.
          </p>
          <p>
            <strong>Conflict Detection:</strong> If your client is behind the server, you'll get a
            409 error and need to sync first.
          </p>
          <p>
            <strong>Auto-Sync:</strong> Enable auto-sync to automatically fetch new operations every
            30 seconds.
          </p>
          <p>
            <strong>Client ID:</strong> Each client has a unique ID to track who performed which
            operations.
          </p>
        </div>
      </div>
    </div>
  )
}
