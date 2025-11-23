import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { syncClient, SyncEvent } from '@/services/syncClient'
import { getSyncStatus, getMyOperations } from '@/services/sync.service'
import { SyncOperation } from '@/types/api'
import HomeLink from '@/components/common/home-link'
import { useTranslation } from 'react-i18next'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

export default function Sync() {
  const [isLoading, setIsLoading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<{
    currentSequence: number
    clientLastSequence: number
    isInSync: boolean
    operationsBehind: number
  } | null>(null)
  const { t } = useTranslation()
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
      setSyncEvents((prev) => [eventMsg, ...prev].slice(0, 20)) // Keep last 20 events

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
    if (
      confirm(
        'Are you sure you want to reset sync state? This will set your sequence to 0.'
      )
    ) {
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
    <div className="w-full flex flex-col px-6 py-6 h-full gap-6 bg-white">
      <div className="space-y-3 shrink-0">
        <HomeLink />
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-4xl font-bold font-sans text-gray-900">Sync</h1>
        </div>
      </div>
      <div className="border-t border-gray-300 shrink-0" />

      <ScrollArea className="h-full w-full rounded-md">
        <Accordion
          type="multiple"
          defaultValue={['status', 'controls', 'events', 'operations']}
          className="w-full space-y-6 p-1"
        >
          {/* Sync Status Card */}
          <AccordionItem
            value="status"
            className="bg-white rounded-lg shadow-md border-none"
          >
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <h2 className="text-xl font-semibold">Sync Status</h2>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6 border-t border-gray-100 pt-4">
              <div className="flex justify-end mb-4">
                <Button onClick={loadSyncStatus} variant="outline" size="sm">
                  Refresh Status
                </Button>
              </div>

              {syncStatus ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Client ID</div>
                    <div
                      className="font-mono text-sm truncate"
                      title={syncClient.getClientId()}
                    >
                      {syncClient.getClientId().substring(0, 20)}...
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">
                      Server Sequence
                    </div>
                    <div className="text-2xl font-bold">
                      {syncStatus.currentSequence}
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">
                      Client Sequence
                    </div>
                    <div className="text-2xl font-bold">
                      {syncClient.getLastSyncSequence()}
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Status</div>
                    <div className="flex items-center gap-2">
                      {syncStatus.isInSync ? (
                        <span className="text-green-600 font-semibold">
                          ✓ In Sync
                        </span>
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
            </AccordionContent>
          </AccordionItem>

          {/* Sync Controls */}
          <AccordionItem
            value="controls"
            className="bg-white rounded-lg shadow-md border-none"
          >
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <h2 className="text-xl font-semibold">Controls</h2>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6 border-t border-gray-100 pt-4">
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
                  {autoSyncEnabled
                    ? '⏸ Stop Auto-Sync'
                    : '▶️ Start Auto-Sync (30s)'}
                </Button>
                <Button
                  onClick={handleInitialize}
                  disabled={isLoading}
                  variant="outline"
                >
                  {isLoading ? 'Initializing...' : '🚀 Initialize'}
                </Button>
                <Button onClick={handleResetSync} variant="outline">
                  🔄 Reset Sync State
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Recent Sync Events */}
          <AccordionItem
            value="events"
            className="bg-white rounded-lg shadow-md border-none"
          >
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <h2 className="text-xl font-semibold">Recent Sync Events</h2>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6 border-t border-gray-100 pt-4">
              {syncEvents.length > 0 ? (
                <div className="bg-gray-900 text-green-400 font-mono text-xs p-4 rounded-lg max-h-64 overflow-y-auto">
                  {syncEvents.map((event, index) => (
                    <div key={index} className="mb-1">
                      {event}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500">
                  No events yet. Perform a sync to see events.
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* My Operations */}
          <AccordionItem
            value="operations"
            className="bg-white rounded-lg shadow-md border-none"
          >
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <h2 className="text-xl font-semibold">My Recent Operations</h2>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6 border-t border-gray-100 pt-4">
              <div className="flex justify-end mb-4">
                <Button onClick={loadMyOperations} variant="outline" size="sm">
                  Refresh List
                </Button>
              </div>

              {myOperations.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 text-sm font-semibold">
                          Seq
                        </th>
                        <th className="text-left py-2 px-3 text-sm font-semibold">
                          Operation
                        </th>
                        <th className="text-left py-2 px-3 text-sm font-semibold">
                          Image UUID
                        </th>
                        <th className="text-left py-2 px-3 text-sm font-semibold">
                          Time
                        </th>
                        <th className="text-left py-2 px-3 text-sm font-semibold">
                          Metadata
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {myOperations.map((op) => (
                        <tr key={op.id} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-3 font-mono text-sm">
                            {op.sequenceNumber}
                          </td>
                          <td className="py-2 px-3">
                            <span className="text-lg mr-2">
                              {getOperationIcon(op.operation)}
                            </span>
                            <span className="text-sm">{op.operation}</span>
                          </td>
                          <td className="py-2 px-3 font-mono text-xs">
                            {op.imageUuid
                              ? op.imageUuid.substring(0, 8)
                              : '-'}
                          </td>
                          <td className="py-2 px-3 text-sm">
                            {new Date(op.createdAt).toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-xs text-gray-600">
                            {Object.keys(op.metadata || {}).length > 0
                              ? JSON.stringify(op.metadata).substring(0, 50) +
                                '...'
                              : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-gray-500">
                  No operations found for your client.
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </ScrollArea>
    </div>
  )
}